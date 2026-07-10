import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantRole } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { RedisService } from '../../common/redis/redis.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: PrismaService;
  let emailQueue: any;
  let emailService: any;

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenantMembership: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockEmailService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'BullQueue_email', useValue: mockQueue },
        { provide: EmailService, useValue: mockEmailService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    prisma = module.get<PrismaService>(PrismaService);
    emailQueue = module.get('BullQueue_email');
    emailService = module.get(EmailService);

    jest.clearAllMocks();
    mockEmailService.enqueue.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a tenant and make user the owner', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-1', name: 'My Org', slug: 'my-org' });

      const result = await service.create({ name: 'My Org', slug: 'my-org' }, 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('tenant-1');
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
        data: { name: 'My Org', slug: 'my-org' },
      });
      expect(mockPrisma.tenantMembership.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          role: TenantRole.OWNER,
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'My Org', slug: 'my-org' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('addMember', () => {
    it('should add member to a tenant and send invitation email', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', name: 'My Org' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'member@test.com', name: 'Member' });
      mockPrisma.tenantMembership.findUnique.mockResolvedValue(null);
      mockPrisma.tenantMembership.create.mockResolvedValue({ id: 'membership-1' });

      const result = await service.addMember('tenant-1', { email: 'member@test.com', role: TenantRole.MEMBER }, 'user-1');

      expect(result).toBeDefined();
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'invite-member' }),
      );
    });

    it('should throw NotFoundException if user is not registered', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('tenant-1', { email: 'notfound@test.com', role: TenantRole.MEMBER }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyTenants', () => {
    it('should list tenants for the user', async () => {
      const mockMemberships = [
        {
          role: TenantRole.OWNER,
          tenant: {
            id: 'tenant-1',
            name: 'My Tenant',
            slug: 'my-tenant',
            logoUrl: null,
            isActive: true,
          },
        },
      ];
      mockPrisma.tenantMembership.findMany.mockResolvedValue(mockMemberships);

      const result = await service.getMyTenants('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Tenant');
      expect(result[0].role).toBe(TenantRole.OWNER);
      expect(mockPrisma.tenantMembership.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { tenant: true },
      });
    });
  });
});
