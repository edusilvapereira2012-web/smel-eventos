import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { RegistrationStatus, EventStatus } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';

import { EmailService } from '../email/email.service';
import { EventsGateway } from '../../gateways/events.gateway';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prisma: PrismaService;
  let redis: RedisService;
  let emailQueue: any;

  let emailService: any;

  // Local state to simulate database state under mock
  let localConfirmedCount = 0;
  let localWaitlistCount = 0;
  const createdRegistrations: any[] = [];

  const mockPrisma: any = {
    event: {
      findFirst: jest.fn(),
    },
    registration: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'ENCRYPTION_KEY') return 'super_secret_encryption_key_32_bytes_long_12345678';
      return null;
    }),
  };

  const mockEmailService = {
    enqueue: jest.fn(),
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
        RegistrationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: 'BullQueue_email', useValue: mockQueue },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    emailQueue = module.get('BullQueue_email');
    emailService = module.get(EmailService);
    mockEmailService.enqueue.mockReset();

    // Reset local state
    localConfirmedCount = 0;
    localWaitlistCount = 0;
    createdRegistrations.length = 0;

    jest.clearAllMocks();

    // Default mock setups
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(mockPrisma);
    });

    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create registration', () => {
    it('should create a CONFIRMED registration when capacity is available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'event-1', title: 'Tech Event', slug: 'tech-event', capacity: 10, status: EventStatus.PUBLISHED },
      ]);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.registration.count
        .mockResolvedValueOnce(0) // confirmed count check
        .mockResolvedValueOnce(0); // sequential code prefix check
      
      mockPrisma.registration.create.mockResolvedValue({
        id: 'reg-1',
        code: 'TEC-2026-00001',
        name: 'John Doe',
        email: 'john@test.com',
        cpf: 'encrypted-cpf',
        status: RegistrationStatus.CONFIRMED,
        event: { id: 'event-1', title: 'Tech Event' },
      });

      const dto = {
        name: 'John Doe',
        email: 'john@test.com',
        cpf: '12345678901',
        phone: '11999999999',
      };

      const result = await service.create('event-1', dto);

      expect(result).toBeDefined();
      expect(result.status).toBe(RegistrationStatus.CONFIRMED);
      expect(result.cpf).toBe('***.***.789-01');
      expect(mockPrisma.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.CONFIRMED,
          }),
        }),
      );
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'registration-confirmed' }),
      );
    });

    it('should create a WAITLIST registration when capacity is full', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'event-1', title: 'Tech Event', slug: 'tech-event', capacity: 2, status: EventStatus.PUBLISHED },
      ]);
      mockPrisma.registration.findFirst.mockResolvedValue(null);
      mockPrisma.registration.count
        .mockResolvedValueOnce(2) // confirmed count (full capacity)
        .mockResolvedValueOnce(2) // sequential code prefix count
        .mockResolvedValueOnce(0); // waitlist count check

      mockPrisma.registration.create.mockResolvedValue({
        id: 'reg-3',
        code: 'TEC-2026-00003',
        name: 'Waitlist User',
        email: 'waitlist@test.com',
        cpf: 'encrypted-cpf-3',
        status: RegistrationStatus.WAITLIST,
        waitlistPosition: 1,
        event: { id: 'event-1', title: 'Tech Event' },
      });

      const dto = {
        name: 'Waitlist User',
        email: 'waitlist@test.com',
        cpf: '11122233344',
      };

      const result = await service.create('event-1', dto);

      expect(result).toBeDefined();
      expect(result.status).toBe(RegistrationStatus.WAITLIST);
      expect(result.waitlistPosition).toBe(1);
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'registration-waitlist' }),
      );
    });
  });

  describe('cancel and waitlist promotion', () => {
    it('should cancel registration and promote next user in waitlist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'event-1', title: 'Tech Event', capacity: 2 },
      ]);
      
      // Source registration to cancel
      mockPrisma.registration.findFirst
        .mockResolvedValueOnce({
          id: 'reg-confirmed',
          eventId: 'event-1',
          status: RegistrationStatus.CONFIRMED,
          name: 'Confirmed User',
          email: 'confirmed@test.com',
        }) // inside cancel findFirst
        .mockResolvedValueOnce({
          id: 'reg-waiting-1',
          eventId: 'event-1',
          status: RegistrationStatus.WAITLIST,
          name: 'Waiting One',
          email: 'waiting1@test.com',
          waitlistPosition: 1,
          code: 'TEC-2026-00003',
        }); // nextInWaitlist findFirst

      mockPrisma.registration.update
        .mockResolvedValueOnce({
          id: 'reg-confirmed',
          status: RegistrationStatus.CANCELLED,
          name: 'Confirmed User',
          email: 'confirmed@test.com',
        }) // cancelled update
        .mockResolvedValueOnce({
          id: 'reg-waiting-1',
          status: RegistrationStatus.CONFIRMED,
          name: 'Waiting One',
          email: 'waiting1@test.com',
          code: 'TEC-2026-00003',
        }); // promoted update

      mockPrisma.registration.findMany.mockResolvedValue([]); // remaining waitlist empty

      const result = await service.cancel('event-1', 'reg-confirmed', 'Quero cancelar.');

      expect(result.status).toBe(RegistrationStatus.CANCELLED);
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'registration-cancelled' }),
      );
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'waitlist-promoted' }),
      );
    });
  });

  describe('transfer registration', () => {
    it('should mark source registration as TRANSFERRED and create CONFIRMED recipient registration', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', title: 'Tech Event', slug: 'tech-event' });
      mockPrisma.registration.findFirst
        .mockResolvedValueOnce({
          id: 'reg-source',
          eventId: 'event-1',
          status: RegistrationStatus.CONFIRMED,
          name: 'Source User',
          email: 'source@test.com',
        }) // source findFirst
        .mockResolvedValueOnce(null); // recipient existing check
      
      mockPrisma.registration.count.mockResolvedValue(1);

      mockPrisma.registration.create.mockResolvedValue({
        id: 'reg-recipient',
        status: RegistrationStatus.CONFIRMED,
        code: 'TEC-2026-00002',
        name: 'Recipient User',
        email: 'recipient@test.com',
      });

      mockPrisma.registration.update
        .mockResolvedValueOnce({
          id: 'reg-source',
          status: RegistrationStatus.TRANSFERRED,
          name: 'Source User',
        }) // update source
        .mockResolvedValueOnce({
          id: 'reg-recipient',
          status: RegistrationStatus.CONFIRMED,
          code: 'TEC-2026-00002',
          name: 'Recipient User',
          email: 'recipient@test.com',
        }); // update recipient link

      const dto = {
        name: 'Recipient User',
        email: 'recipient@test.com',
        cpf: '98765432109',
      };

      const result = await service.transfer('event-1', 'reg-source', dto, 'tenant-1');

      expect(result).toBeDefined();
      expect(result.status).toBe(RegistrationStatus.CONFIRMED);
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'registration-confirmed' }),
      );
      expect(mockEmailService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'registration-cancelled' }),
      );
    });
  });

  describe('concurrency', () => {
    it('should serialize registration requests so that only capacity limit is CONFIRMED and the rest are WAITLIST', async () => {
      const capacity = 1;
      let confirmedCount = 0;
      let waitlistCount = 0;
      // Mock $queryRaw to return the event capacity
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'event-1', title: 'Tech Event', slug: 'tech-event', capacity, status: EventStatus.PUBLISHED },
      ]);
      
      // Mock findFirst for existing registrations
      mockPrisma.registration.findFirst.mockResolvedValue(null);

      // Force sequential transaction execution inside the mock using a promise queue!
      let queue = Promise.resolve();
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        // Enqueue the mock execution to happen sequentially
        const result = queue.then(async () => {
          // Re-mock count to return the CURRENT count inside this sequenced step
          mockPrisma.registration.count.mockImplementation(async (args: any) => {
            if (args?.where?.status === RegistrationStatus.CONFIRMED) {
              return confirmedCount;
            }
            if (args?.where?.status === RegistrationStatus.WAITLIST) {
              return waitlistCount;
            }
            return confirmedCount + waitlistCount;
          });

          // Re-mock create to increment the counts
          mockPrisma.registration.create.mockImplementation(async (args: any) => {
            const status = args.data.status;
            if (status === RegistrationStatus.CONFIRMED) {
              confirmedCount++;
            } else {
              waitlistCount++;
            }
            return {
              id: `reg-${Math.random()}`,
              code: args.data.code,
              name: args.data.name,
              email: args.data.email,
              status,
              waitlistPosition: args.data.waitlistPosition,
              event: { id: 'event-1', title: 'Tech Event' },
            };
          });

          return callback(mockPrisma);
        });

        // Update queue pointer
        queue = result.catch(() => {});
        return result;
      });

      // Submit 10 concurrent requests to sign up
      const promises = Array.from({ length: 10 }).map((_, index) => {
        return service.create('event-1', {
          name: `User ${index}`,
          email: `user${index}@test.com`,
          cpf: `1234567890${index % 10}`,
        });
      });

      const results = await Promise.all(promises);
      // Under serialized concurrency, exactly 1 should be CONFIRMED and 9 should be WAITLIST
      const confirmedResults = results.filter(r => r.status === RegistrationStatus.CONFIRMED);
      const waitlistResults = results.filter(r => r.status === RegistrationStatus.WAITLIST);

      expect(confirmedResults.length).toBe(1);
      expect(waitlistResults.length).toBe(9);
      
      // Check waitlist positions are sequential from 1 to 9
      const positions = waitlistResults.map(w => w.waitlistPosition).sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });
});
