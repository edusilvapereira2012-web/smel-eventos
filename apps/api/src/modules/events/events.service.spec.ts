import { Test, TestingModule } from '@nestjs/testing';
import { EventsService, slugify } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStatus } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RedisService } from '../../common/redis/redis.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: PrismaService;
  let emailQueue: any;
  let emailService: any;
  let auditLog: any;

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockPrisma = {
    event: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    eventCategory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventSpeaker: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventSponsor: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    scheduleItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    registration: {
      count: jest.fn(),
      findMany: jest.fn(),
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

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'BullQueue_email', useValue: mockQueue },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get<PrismaService>(PrismaService);
    emailQueue = module.get('BullQueue_email');
    emailService = module.get(EmailService);
    auditLog = module.get<AuditLogService>(AuditLogService);

    jest.clearAllMocks();
    mockEmailService.enqueue.mockReset();
    mockAuditLog.log.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('slugify helper', () => {
    it('should convert strings to lowercase clean slugs', () => {
      expect(slugify('Olá Mundo do Desenvolvimento! (Legal)')).toBe('ola-mundo-do-desenvolvimento-legal');
    });
  });

  describe('create event', () => {
    it('should create an event with automatic slug', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      mockPrisma.event.create.mockResolvedValue({ id: 'event-1', title: 'Tech Conf' });

      const dto = {
        title: 'Tech Conf',
        startDate: '2026-10-01T09:00:00Z',
        endDate: '2026-10-02T18:00:00Z',
        capacity: 100,
      };

      const result = await service.create(dto, 'tenant-1');

      expect(result).toBeDefined();
      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: {
          title: 'Tech Conf',
          slug: 'tech-conf',
          tenantId: 'tenant-1',
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          capacity: 100,
        },
      });
    });

    it('should resolve slug conflict by appending counter suffix', async () => {
      mockPrisma.event.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // original slug exists
        .mockResolvedValueOnce(null); // suffix-1 is free

      mockPrisma.event.create.mockResolvedValue({ id: 'event-2', title: 'Tech Conf' });

      const dto = {
        title: 'Tech Conf',
        startDate: '2026-10-01T09:00:00Z',
        endDate: '2026-10-02T18:00:00Z',
        capacity: 100,
      };

      await service.create(dto, 'tenant-1');

      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'tech-conf-1',
        }),
      });
    });
  });

  describe('delete event', () => {
    it('should delete a DRAFT event with no active registrations', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', status: EventStatus.DRAFT });
      mockPrisma.registration.count.mockResolvedValue(0);
      mockPrisma.event.delete.mockResolvedValue({ id: 'event-1' });

      const result = await service.remove('event-1', 'tenant-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.event.delete).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
    });

    it('should throw BadRequestException if event is not DRAFT', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', status: EventStatus.PUBLISHED });

      await expect(service.remove('event-1', 'tenant-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if event has active registrations', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', status: EventStatus.DRAFT });
      mockPrisma.registration.count.mockResolvedValue(5);

      await expect(service.remove('event-1', 'tenant-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish event', () => {
    it('should transition DRAFT to PUBLISHED and record audit log', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        status: EventStatus.DRAFT,
        title: 'Tech',
        startDate: new Date(),
        endDate: new Date(),
        capacity: 50,
      });
      mockPrisma.event.update.mockResolvedValue({ id: 'event-1', status: EventStatus.PUBLISHED });

      const result = await service.publish('event-1', 'tenant-1', 'user-1', '127.0.0.1', 'Mozilla');

      expect(result.status).toBe(EventStatus.PUBLISHED);
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'user-1',
        'PUBLISH_EVENT',
        'event',
        'event-1',
        {},
        '127.0.0.1',
        'Mozilla',
      );
    });

    it('should throw error if missing capacity', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        status: EventStatus.DRAFT,
        title: 'Tech',
        startDate: new Date(),
        endDate: new Date(),
        capacity: 0,
      });

      await expect(service.publish('event-1', 'tenant-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel event', () => {
    it('should cancel event and queue cancel emails to active participants', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        status: EventStatus.PUBLISHED,
        title: 'Tech Conf',
      });
      mockPrisma.event.update.mockResolvedValue({ id: 'event-1', status: EventStatus.CANCELLED });
      mockPrisma.registration.findMany.mockResolvedValue([
        { id: 'reg-1', email: 'user1@test.com', name: 'User One' },
        { id: 'reg-2', email: 'user2@test.com', name: 'User Two' },
      ]);

      const result = await service.cancel('event-1', 'tenant-1', 'user-1');

      expect(result.status).toBe(EventStatus.CANCELLED);
      expect(mockEmailService.enqueue).toHaveBeenCalledTimes(2);
      expect(mockEmailService.enqueue).toHaveBeenNthCalledWith(1, expect.objectContaining({
        template: 'event-cancelled',
        to: 'user1@test.com',
      }));
    });
  });

  describe('reorder schedule items', () => {
    it('should update orders using database transaction', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1' });
      mockPrisma.scheduleItem.findMany.mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ]);
      mockPrisma.$transaction.mockImplementation(async (promises) => promises);

      const result = await service.reorderSchedule('event-1', ['item-2', 'item-1'], 'tenant-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.scheduleItem.update).toHaveBeenCalledTimes(2);
    });
  });
});
