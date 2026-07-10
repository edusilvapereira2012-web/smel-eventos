import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import * as argon2 from 'argon2';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConfigService } from '@nestjs/config';

jest.mock('argon2');

import { EmailService } from '../email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let emailQueue: any;
  let emailService: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn(),
  };

  const mockRedis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockEmailService = {
    enqueue: jest.fn(),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue({}),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('super_secret_encryption_key_32_bytes_long_12345678'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: RedisService, useValue: mockRedis },
        { provide: 'BullQueue_email', useValue: mockQueue },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    emailQueue = module.get('BullQueue_email');
    emailService = module.get(EmailService);

    jest.clearAllMocks();
    mockEmailService.enqueue.mockReset();
    mockAuditLog.log.mockReset();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user_id',
        name: 'John Doe',
        email: 'john@example.com',
      });

      const result = await service.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result.message).toContain('Cadastro realizado com sucesso');
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'verify-email' }),
      );
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing_id' });

      await expect(
        service.register({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_id',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashed_password',
        isActive: true,
        emailVerified: true,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token_string');
      mockRedis.set.mockResolvedValue(null);

      const result = await service.login(
        {
          email: 'john@example.com',
          password: 'password123',
        },
        '127.0.0.1',
        'Mozilla',
      );

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'user_id',
        'LOGIN_SUCCESS',
        'user',
        'user_id',
        {},
        '127.0.0.1',
        'Mozilla',
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_id',
        passwordHash: 'hashed_password',
        isActive: true,
        emailVerified: true,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'user_id',
        'LOGIN_FAILURE',
        'user',
        'user_id',
        { reason: 'invalid_password' },
        undefined,
        undefined,
      );
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_id',
        passwordHash: 'hashed_password',
        isActive: true,
        emailVerified: false,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate the refresh token and return new access/refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_id',
        email: 'john@example.com',
        isActive: true,
      });

      mockRedis.del.mockResolvedValue(null);
      mockJwt.sign.mockReturnValue('new_token_string');
      mockRedis.set.mockResolvedValue(null);

      const result = await service.refresh('user_id', 'old_token_id');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user_id:old_token_id');
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should mark email as verified and queue welcome email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user_id',
        name: 'John Doe',
        email: 'john@example.com',
      });

      mockPrisma.user.update.mockResolvedValue({ id: 'user_id' });

      const result = await service.verifyEmail('token_123');

      expect(result.message).toContain('E-mail verificado');
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'welcome' }),
      );
    });

    it('should throw BadRequestException if verify token is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid_token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportUserData', () => {
    it('should export masked CPF and all user associations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_id',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockRegs = [
        {
          id: 'reg-1',
          code: 'REG123',
          name: 'John Doe',
          email: 'john@example.com',
          cpf: null,
          phone: '123456789',
          status: 'CONFIRMED',
          checkedInAt: null,
          createdAt: new Date(),
          event: { title: 'JS Conf', startDate: new Date() },
          checkIn: null,
          certificate: null,
        },
      ];
      (mockPrisma as any).registration = {
        findMany: jest.fn().mockResolvedValue(mockRegs),
      };
      (mockPrisma as any).auditLog = {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      };

      const result = await service.exportUserData('user_id');
      expect(result.user.name).toBe('John Doe');
      expect(result.registrations).toHaveLength(1);
      expect(result.registrations[0].cpf).toBeNull();
    });
  });

  describe('deleteUserAccount', () => {
    it('should reject if confirmation text is wrong', async () => {
      await expect(
        service.deleteUserAccount('user_id', 'WRONG TEXT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should anonymize user, registrations, and clear session tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_id',
        name: 'John Doe',
        email: 'john@example.com',
      });

      (mockPrisma as any).registration = {
        findMany: jest.fn().mockResolvedValue([{ id: 'reg-1' }]),
        update: jest.fn().mockResolvedValue({}),
      };
      (mockPrisma as any).user = {
        findUnique: jest.fn().mockResolvedValue({ id: 'user_id', email: 'john@example.com' }),
        update: jest.fn().mockResolvedValue({}),
      };
      (mockPrisma as any).auditLog = {
        updateMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      };
      (mockPrisma as any).$transaction = jest.fn().mockImplementation(async (cb) => cb(mockPrisma));

      const result = await service.deleteUserAccount('user_id', 'EXCLUIR MINHA CONTA', '127.0.0.1', 'Mozilla');
      expect(result.success).toBe(true);
      expect(mockRedis.delPattern).toHaveBeenCalledWith('refresh:user_id:*');
      expect(mockAuditLog.log).toHaveBeenCalled();
    });
  });
});
