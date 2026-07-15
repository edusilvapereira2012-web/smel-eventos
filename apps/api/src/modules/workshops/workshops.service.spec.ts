import { Test, TestingModule } from '@nestjs/testing';
import { WorkshopsService } from './workshops.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('WorkshopsService', () => {
  let service: WorkshopsService;
  let prisma: PrismaService;
  let auditLog: any;

  const mockPrisma = {
    event: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    workshop: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    eventSpeaker: {
      findFirst: jest.fn(),
    },
    workshopEnrollment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkshopsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<WorkshopsService>(WorkshopsService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLog = module.get<AuditLogService>(AuditLogService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create workshop', () => {
    it('should create workshop successfully', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.workshop.create.mockResolvedValue({ id: 'w-1', title: 'Oficina 1' });

      const dto = {
        title: 'Oficina 1',
        startTime: '2026-10-01T14:00:00Z',
        endTime: '2026-10-01T16:00:00Z',
        capacity: 30,
      };

      const result = await service.create('event-1', dto, 'tenant-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.title).toBe('Oficina 1');
      expect(mockPrisma.workshop.create).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'user-1',
        'CREATE_WORKSHOP',
        'workshop',
        'w-1',
        { eventId: 'event-1' },
        undefined,
        undefined,
      );
    });

    it('should throw BadRequestException if speaker does not belong to the event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.eventSpeaker.findFirst.mockResolvedValue(null);

      const dto = {
        title: 'Oficina 1',
        startTime: '2026-10-01T14:00:00Z',
        endTime: '2026-10-01T16:00:00Z',
        capacity: 30,
        speakerId: 'invalid-speaker',
      };

      await expect(service.create('event-1', dto, 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enrollParticipant', () => {
    it('should execute validations and enroll a participant successfully inside transaction', async () => {
      const mockTx = {
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1', maxWorkshops: 2 }),
        },
        registration: {
          findUnique: jest.fn().mockResolvedValue({ id: 'reg-1', eventId: 'event-1', status: 'CONFIRMED' }),
        },
        workshop: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'w-1',
            title: 'Oficina 1',
            startTime: new Date('2026-10-01T14:00:00Z'),
            endTime: new Date('2026-10-01T16:00:00Z'),
          }),
        },
        workshopEnrollment: {
          count: jest.fn()
            .mockResolvedValueOnce(10) // current enrollments count for capacity check
            .mockResolvedValueOnce(1), // user current enrollments count for maxWorkshops check
          findUnique: jest.fn().mockResolvedValue(null), // already enrolled check
          findMany: jest.fn().mockResolvedValue([]), // schedule overlap check
          create: jest.fn().mockResolvedValue({ id: 'enc-1', registrationId: 'reg-1', workshopId: 'w-1' }),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'w-1', title: 'Oficina 1', capacity: 30, startTime: '2026-10-01T14:00:00Z', endTime: '2026-10-01T16:00:00Z' }]),
      };

      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      const result = await service.enrollParticipant('event-1', 'reg-1', 'w-1', 'tenant-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('enc-1');
      expect(mockTx.workshopEnrollment.create).toHaveBeenCalledWith({
        data: {
          registrationId: 'reg-1',
          workshopId: 'w-1',
        },
      });
    });

    it('should throw BadRequestException if capacity is reached', async () => {
      const mockTx = {
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1', maxWorkshops: 2 }),
        },
        registration: {
          findUnique: jest.fn().mockResolvedValue({ id: 'reg-1', eventId: 'event-1', status: 'CONFIRMED' }),
        },
        workshopEnrollment: {
          count: jest.fn().mockResolvedValue(30), // 30 enrolled
          findUnique: jest.fn().mockResolvedValue(null),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'w-1', title: 'Oficina 1', capacity: 30 }]),
      };

      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      await expect(service.enrollParticipant('event-1', 'reg-1', 'w-1', 'tenant-1')).rejects.toThrow(
        new BadRequestException('Vagas esgotadas para a oficina "Oficina 1".'),
      );
    });

    it('should throw BadRequestException if schedule overlaps', async () => {
      const mockTx = {
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1', maxWorkshops: 2 }),
        },
        registration: {
          findUnique: jest.fn().mockResolvedValue({ id: 'reg-1', eventId: 'event-1', status: 'CONFIRMED' }),
        },
        workshopEnrollment: {
          count: jest.fn()
            .mockResolvedValueOnce(5)
            .mockResolvedValueOnce(1),
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'enc-existing',
              workshop: {
                id: 'w-existing',
                title: 'Conflitante',
                startTime: new Date('2026-10-01T15:00:00Z'),
                endTime: new Date('2026-10-01T17:00:00Z'),
              },
            },
          ]),
        },
        $queryRaw: jest.fn().mockResolvedValue([{
          id: 'w-new',
          title: 'Nova Oficina',
          capacity: 30,
          startTime: '2026-10-01T14:00:00Z',
          endTime: '2026-10-01T16:00:00Z',
        }]),
      };

      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      await expect(service.enrollParticipant('event-1', 'reg-1', 'w-new', 'tenant-1')).rejects.toThrow(
        /Conflito de horário/,
      );
    });

    it('should throw BadRequestException if maxWorkshops limit is exceeded', async () => {
      const mockTx = {
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1', maxWorkshops: 2 }),
        },
        registration: {
          findUnique: jest.fn().mockResolvedValue({ id: 'reg-1', eventId: 'event-1', status: 'CONFIRMED' }),
        },
        workshopEnrollment: {
          count: jest.fn()
            .mockResolvedValueOnce(5) // capacity check
            .mockResolvedValueOnce(2), // 2 enrolled already, max is 2
          findUnique: jest.fn().mockResolvedValue(null),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'w-new', title: 'Nova Oficina', capacity: 30 }]),
      };

      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

      await expect(service.enrollParticipant('event-1', 'reg-1', 'w-new', 'tenant-1')).rejects.toThrow(
        /Você atingiu o limite máximo de 2 oficinas/,
      );
    });
  });
});
