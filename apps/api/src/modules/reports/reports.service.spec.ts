import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantRole, RegistrationStatus } from '@prisma/client';

jest.mock('../../common/utils/encryption.helper', () => ({
  decrypt: jest.fn((val) => `decrypted-${val}`),
  maskCpf: jest.fn((val) => `masked-${val}`),
}));

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    event: {
      findFirst: jest.fn(),
    },
    tenantMembership: {
      findUnique: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'ENCRYPTION_KEY') return 'test_encryption_key_32_bytes_long_!';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'normal@test.com' });
  });

  describe('exportCsv / exportExcel', () => {
    const mockEvent = { id: 'event-123', tenantId: 'tenant-123', slug: 'test-event', title: 'Test Event' };
    const mockRegistrations = [
      {
        id: 'reg-1',
        code: 'EV-001',
        name: 'Ana Souza',
        email: 'ana@test.com',
        cpf: '12345678901',
        phone: '11999999999',
        status: RegistrationStatus.CONFIRMED,
        createdAt: new Date(),
      },
    ];

    it('exportação sensível sem permissão (ORGANIZER) → erro ForbiddenException', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);
      mockPrisma.tenantMembership.findUnique.mockResolvedValue({ role: TenantRole.ORGANIZER });

      await expect(
        service.exportCsv('event-123', true, 'tenant-123', 'user-1', '127.0.0.1', 'Mozilla')
      ).rejects.toThrow(ForbiddenException);
    });

    it('exportação sensível com permissão (ADMIN) → descriptografa CPF, grava AuditLog e exporta CSV', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);
      mockPrisma.tenantMembership.findUnique.mockResolvedValue({ role: TenantRole.ADMIN });
      mockPrisma.registration.findMany.mockResolvedValue(mockRegistrations);

      const result = await service.exportCsv('event-123', true, 'tenant-123', 'user-1', '127.0.0.1', 'Mozilla');

      expect(result.csvContent).toBeDefined();
      expect(result.eventSlug).toBe('test-event');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('exportação comum (não sensível) → mascara CPF, não grava AuditLog', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);
      mockPrisma.tenantMembership.findUnique.mockResolvedValue({ role: TenantRole.ORGANIZER });
      mockPrisma.registration.findMany.mockResolvedValue(mockRegistrations);

      const result = await service.exportCsv('event-123', false, 'tenant-123', 'user-1', '127.0.0.1', 'Mozilla');

      expect(result.csvContent).toBeDefined();
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('exportação sensível com superadmin (valterpcjr@gmail.com) sem membership → exporta com sucesso', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'valterpcjr@gmail.com' });
      mockPrisma.registration.findMany.mockResolvedValue(mockRegistrations);

      const result = await service.exportCsv('event-123', true, 'tenant-123', 'user-1', '127.0.0.1', 'Mozilla');

      expect(result.csvContent).toBeDefined();
      expect(result.eventSlug).toBe('test-event');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('generatePresenceListPdf', () => {
    it('evento inexistente → erro NotFoundException', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.generatePresenceListPdf('event-123', 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('evento válido → gera PDF com nomes em ordem alfabética', async () => {
      const mockEvent = { id: 'event-123', tenantId: 'tenant-123', slug: 'test-event', title: 'Test Event' };
      const mockRegistrations = [
        { code: 'EV-001', name: 'Bernardo Silva', email: 'bernardo@test.com', status: RegistrationStatus.CONFIRMED },
        { code: 'EV-002', name: 'Ana Souza', email: 'ana@test.com', status: RegistrationStatus.CONFIRMED },
      ];

      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);
      mockPrisma.registration.findMany.mockResolvedValue(mockRegistrations);

      const result = await service.generatePresenceListPdf('event-123', 'tenant-123');

      expect(result.buffer).toBeDefined();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.eventSlug).toBe('test-event');
    });
  });
});
