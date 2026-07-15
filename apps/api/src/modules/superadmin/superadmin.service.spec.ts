import { Test, TestingModule } from '@nestjs/testing';
import { SuperadminService } from './superadmin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';

describe('SuperadminService', () => {
  let service: SuperadminService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    tenant: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    event: {
      count: jest.fn(),
    },
    registration: {
      count: jest.fn(),
    },
    emailLog: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperadminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'BullQueue_email', useValue: mockQueue },
      ],
    }).compile();

    service = module.get<SuperadminService>(SuperadminService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('deve retornar contagens corretas', async () => {
      mockPrisma.tenant.count.mockResolvedValue(5);
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.event.count.mockResolvedValue(15);
      mockPrisma.registration.count.mockResolvedValue(20);

      const stats = await service.getStats();

      expect(stats).toEqual({
        totalTenants: 5,
        totalUsers: 10,
        totalEvents: 15,
        totalRegistrations: 20,
      });
    });
  });

  describe('getTenants', () => {
    it('deve retornar lista formatada de tenants', async () => {
      const mockTenants = [
        {
          id: 'tenant-1',
          name: 'Tenant 1',
          slug: 'tenant-1',
          logoUrl: null,
          isActive: true,
          createdAt: new Date(),
          _count: {
            memberships: 3,
            events: 2,
          },
        },
      ];
      mockPrisma.tenant.findMany.mockResolvedValue(mockTenants);

      const result = await service.getTenants();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        logoUrl: null,
        isActive: true,
        createdAt: mockTenants[0].createdAt,
        membersCount: 3,
        eventsCount: 2,
      });
    });
  });

  describe('toggleTenantStatus', () => {
    it('deve alternar isActive do tenant', async () => {
      const mockTenant = { id: 'tenant-1', isActive: true };
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.tenant.update.mockResolvedValue({ ...mockTenant, isActive: false });

      const result = await service.toggleTenantStatus('tenant-1');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('deve lançar erro se tenant não existir', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.toggleTenantStatus('tenant-invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUsers', () => {
    it('deve retornar lista formatada de usuários', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          isActive: true,
          emailVerified: true,
          createdAt: new Date(),
          _count: {
            tenantMemberships: 1,
            registrations: 4,
          },
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getUsers();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'user-1',
        name: 'User 1',
        email: 'user1@test.com',
        isActive: true,
        emailVerified: true,
        createdAt: mockUsers[0].createdAt,
        tenantsCount: 1,
        registrationsCount: 4,
      });
    });
  });

  describe('toggleUserStatus', () => {
    it('deve alternar isActive do usuário', async () => {
      const mockUser = { id: 'user-1', isActive: true };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.toggleUserStatus('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('deve lançar erro se usuário não existir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.toggleUserStatus('user-invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEmailLogs', () => {
    it('deve retornar logs paginados com metadados corretos', async () => {
      const mockLogs = [
        { id: 'log-1', to: 'test@test.com', subject: 'Subject', template: 'temp', status: EmailStatus.SENT },
      ];
      mockPrisma.emailLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.emailLog.count.mockResolvedValue(1);

      const result = await service.getEmailLogs(1, 10, EmailStatus.SENT, 'test');

      expect(mockPrisma.emailLog.findMany).toHaveBeenCalledWith({
        where: {
          status: EmailStatus.SENT,
          OR: [
            { to: { contains: 'test', mode: 'insensitive' } },
            { subject: { contains: 'test', mode: 'insensitive' } },
            { template: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.data).toEqual(mockLogs);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getEmailStats', () => {
    it('deve calcular estatísticas de emails agrupadas por status', async () => {
      mockPrisma.emailLog.groupBy.mockResolvedValue([
        { status: EmailStatus.SENT, _count: 10 },
        { status: EmailStatus.FAILED, _count: 2 },
        { status: EmailStatus.DEAD, _count: 1 },
        { status: EmailStatus.PENDING, _count: 3 },
      ]);

      const result = await service.getEmailStats();

      expect(result).toEqual({
        sent: 10,
        failed: 2,
        dead: 1,
        pendingInQueue: 3,
      });
    });
  });

  describe('retryEmail', () => {
    it('deve reiniciar as tentativas e reenviar o email para a fila', async () => {
      const mockLog = { id: 'log-1', template: 'welcome-email', status: EmailStatus.FAILED };
      const updatedLog = { ...mockLog, status: EmailStatus.PENDING, attempts: 0, lastError: null };
      mockPrisma.emailLog.findUnique.mockResolvedValue(mockLog);
      mockPrisma.emailLog.update.mockResolvedValue(updatedLog);

      const result = await service.retryEmail('log-1');

      expect(mockPrisma.emailLog.findUnique).toHaveBeenCalledWith({ where: { id: 'log-1' } });
      expect(mockPrisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: EmailStatus.PENDING,
          attempts: 0,
          lastError: null,
        },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'welcome-email',
        { emailLogId: 'log-1' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      );
      expect(result.log).toEqual(updatedLog);
    });

    it('deve lançar NotFoundException se log de email não existir', async () => {
      mockPrisma.emailLog.findUnique.mockResolvedValue(null);

      await expect(service.retryEmail('log-invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
