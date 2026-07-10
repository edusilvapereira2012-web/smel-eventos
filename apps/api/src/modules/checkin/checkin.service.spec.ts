import { Test, TestingModule } from '@nestjs/testing';
import { CheckInService } from './checkin.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CheckInGateway } from './checkin.gateway';
import { EventsGateway } from '../../gateways/events.gateway';
import { RegistrationStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';

describe('CheckInService', () => {
  let service: CheckInService;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let checkInGateway: jest.Mocked<CheckInGateway>;

  const mockPrisma = {
    registration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    checkIn: {
      create: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockJwt = {
    verify: jest.fn(),
    sign: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'QR_SECRET') return 'test_secret';
      return null;
    }),
  };

  const mockGateway = {
    broadcastCheckIn: jest.fn(),
  };

  const mockEventsGateway = {
    emitToCheckIn: jest.fn(),
    emitToRegistrationNew: jest.fn(),
    emitToRegistrationCancelled: jest.fn(),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CheckInGateway, useValue: mockGateway },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<CheckInService>(CheckInService);
    jwtService = module.get(JwtService);
    prisma = module.get(PrismaService);
    redisService = module.get(RedisService);
    checkInGateway = module.get(CheckInGateway);

    jest.clearAllMocks();
  });

  describe('validateAndCheckIn', () => {
    it('check-in válido → sucesso', async () => {
      const token = 'valid_token';
      const registrationId = 'reg-123';
      const eventId = 'event-456';
      const mockRegistration = {
        id: registrationId,
        eventId,
        code: 'EVH-2026-00001',
        name: 'John Doe',
        status: RegistrationStatus.CONFIRMED,
        checkIn: null,
        event: { tenantId: 'tenant-123' },
      };

      jwtService.verify.mockReturnValue({ sub: registrationId, eventId, code: 'EVH-2026-00001' });
      redisService.get.mockResolvedValue(null);
      mockPrisma.registration.findUnique.mockResolvedValue(mockRegistration);
      mockPrisma.checkIn.create.mockResolvedValue({ id: 'checkin-123' });
      mockPrisma.registration.update.mockResolvedValue({ ...mockRegistration, checkedInAt: new Date() });

      const result = await service.validateAndCheckIn(token, 'op-1', 'dev-1');

      expect(result.success).toBe(true);
      expect(result.registration.name).toBe('John Doe');
      expect(mockPrisma.checkIn.create).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(`checkin:${registrationId}`, expect.any(String), 86400);
      expect(mockGateway.broadcastCheckIn).toHaveBeenCalled();
    });

    it('check-in duplicado (no Redis) → 409', async () => {
      const token = 'valid_token';
      const registrationId = 'reg-123';
      const eventId = 'event-456';

      jwtService.verify.mockReturnValue({ sub: registrationId, eventId });
      redisService.get.mockResolvedValue(new Date().toISOString());

      await expect(service.validateAndCheckIn(token)).rejects.toThrow(ConflictException);
      expect(mockPrisma.registration.findUnique).not.toHaveBeenCalled();
    });

    it('check-in duplicado (no Banco) → 409', async () => {
      const token = 'valid_token';
      const registrationId = 'reg-123';
      const eventId = 'event-456';
      const mockRegistration = {
        id: registrationId,
        eventId,
        code: 'EVH-2026-00001',
        name: 'John Doe',
        status: RegistrationStatus.CONFIRMED,
        checkIn: { id: 'checkin-123', checkedInAt: new Date() },
        event: { tenantId: 'tenant-123' },
      };

      jwtService.verify.mockReturnValue({ sub: registrationId, eventId });
      redisService.get.mockResolvedValue(null);
      mockPrisma.registration.findUnique.mockResolvedValue(mockRegistration);

      await expect(service.validateAndCheckIn(token)).rejects.toThrow(ConflictException);
      expect(mockRedis.set).toHaveBeenCalledWith(`checkin:${registrationId}`, expect.any(String), 86400);
    });

    it('QR inválido (assinatura errada) → 400', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.validateAndCheckIn('invalid_token')).rejects.toThrow(BadRequestException);
    });

    it('Inscrição cancelada → 422', async () => {
      const token = 'valid_token';
      const registrationId = 'reg-123';
      const eventId = 'event-456';
      const mockRegistration = {
        id: registrationId,
        eventId,
        code: 'EVH-2026-00001',
        name: 'John Doe',
        status: RegistrationStatus.CANCELLED,
        checkIn: null,
        event: { tenantId: 'tenant-123' },
      };

      jwtService.verify.mockReturnValue({ sub: registrationId, eventId });
      redisService.get.mockResolvedValue(null);
      mockPrisma.registration.findUnique.mockResolvedValue(mockRegistration);

      await expect(service.validateAndCheckIn(token)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('syncOffline', () => {
    it('Sync offline: batch com 1 duplicata → processed: 1, duplicates: 1', async () => {
      const eventId = 'event-456';
      const checkins = [
        { registrationId: 'reg-ok', eventId, checkedInAt: new Date().toISOString(), deviceId: 'dev-1' },
        { registrationId: 'reg-dup', eventId, checkedInAt: new Date().toISOString(), deviceId: 'dev-1' },
      ];

      // reg-ok vai funcionar
      mockPrisma.registration.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'reg-ok') {
          return Promise.resolve({
            id: 'reg-ok',
            eventId,
            code: 'EVH-1',
            name: 'User Ok',
            status: RegistrationStatus.CONFIRMED,
            checkIn: null,
            event: { tenantId: 'tenant-123' },
          });
        }
        return Promise.resolve(null);
      });

      // reg-dup vai falhar no Redis com duplicado
      redisService.get.mockImplementation(async (key: string) => {
        if (key === 'checkin:reg-dup') {
          return new Date().toISOString();
        }
        return null;
      });

      const result = await service.syncOffline(checkins, 'op-1');

      expect(result.processed).toBe(1);
      expect(result.duplicates).toBe(1);
      expect(result.errors.length).toBe(0);
    });
  });
});
