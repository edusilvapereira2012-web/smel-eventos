import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CertificatesService', () => {
  let service: CertificatesService;
  let prisma: jest.Mocked<PrismaService>;
  let queue: any;

  const mockPrisma = {
    event: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
    },
    certificate: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('certificates'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
    prisma = module.get(PrismaService);
    queue = module.get(getQueueToken('certificates'));

    jest.clearAllMocks();
  });

  describe('generateBatch', () => {
    it('evento não existe para inquilino → 404', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.generateBatch('event-1', 'tenant-1')).rejects.toThrow(NotFoundException);
    });

    it('nenhuma inscrição elegível → retorna count 0', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.registration.findMany.mockResolvedValue([]);

      const result = await service.generateBatch('event-1', 'tenant-1');

      expect(result.count).toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('inscrições elegíveis → enfileira jobs e retorna count', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.registration.findMany.mockResolvedValue([
        { id: 'reg-1', name: 'John Doe', email: 'john@example.com' },
        { id: 'reg-2', name: 'Jane Doe', email: 'jane@example.com' },
      ]);

      const result = await service.generateBatch('event-1', 'tenant-1');

      expect(result.count).toBe(2);
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenNthCalledWith(
        1,
        'generate-certificate',
        { registrationId: 'reg-1', tenantId: 'tenant-1', eventId: 'event-1' },
        expect.any(Object),
      );
    });
  });

  describe('findByCode', () => {
    it('certificado não encontrado → 404', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      await expect(service.findByCode('CERT-INVALID')).rejects.toThrow(NotFoundException);
    });

    it('certificado encontrado → retorna dados de validação formatados', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({
        id: 'cert-1',
        code: 'CERT-1234',
        eventId: 'event-1',
        issuedAt: new Date('2026-06-24T12:00:00Z'),
        registration: { name: 'John Doe' },
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        title: 'Event Test',
        startDate: new Date('2026-06-20T10:00:00Z'),
      });

      const result = await service.findByCode('CERT-1234');

      expect(result).toEqual({
        valid: true,
        participantName: 'John Doe',
        eventTitle: 'Event Test',
        eventDate: '2026-06-20',
        issuedAt: expect.any(Date),
      });
    });
  });

  describe('downloadCertificate', () => {
    it('certificado não encontrado → 404', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      await expect(service.downloadCertificate('CERT-INVALID')).rejects.toThrow(NotFoundException);
    });

    it('certificado encontrado → incrementa contador e retorna URL', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({
        id: 'cert-1',
        code: 'CERT-1234',
        fileUrl: 'http://minio/cert.pdf',
      });
      mockPrisma.certificate.update.mockResolvedValue({} as any);

      const result = await service.downloadCertificate('CERT-1234');

      expect(result).toBe('http://minio/cert.pdf');
      expect(mockPrisma.certificate.update).toHaveBeenCalledWith({
        where: { code: 'CERT-1234' },
        data: { downloadCount: { increment: 1 } },
      });
    });
  });
});
