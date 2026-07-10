import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotFoundException } from '@nestjs/common';
import { EventStatus, RegistrationStatus } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;

  const mockPrisma = {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
    },
    checkIn: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    certificate: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);

    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('retorno do cache (Valkey/Redis) → sucesso sem consultar BD', async () => {
      const cachedData = {
        events: { total: 10, published: 5, upcoming: 2, finished: 3 },
        registrations: { total: 100, confirmed: 80, waitlist: 15, cancelled: 5 },
        checkins: { total: 40, rate: 50.0 },
        certificates: { issued: 30, downloaded: 12 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getOverview('tenant-123');

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('dashboard:overview:tenant-123');
      expect(mockPrisma.event.findMany).not.toHaveBeenCalled();
    });

    it('cache miss → consulta BD, calcula estatísticas e salva no cache', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockEvents = [
        { status: EventStatus.PUBLISHED, startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 172800000) }, // upcoming
        { status: EventStatus.PUBLISHED, startDate: new Date(Date.now() - 172800000), endDate: new Date(Date.now() - 86400000) }, // finished
        { status: EventStatus.DRAFT, startDate: new Date(), endDate: new Date() },
      ];
      mockPrisma.event.findMany.mockResolvedValue(mockEvents);

      const mockRegistrations = [
        { status: RegistrationStatus.CONFIRMED },
        { status: RegistrationStatus.CONFIRMED },
        { status: RegistrationStatus.WAITLIST },
        { status: RegistrationStatus.CANCELLED },
      ];
      mockPrisma.registration.findMany.mockResolvedValue(mockRegistrations);
      mockPrisma.checkIn.count.mockResolvedValue(1);
      mockPrisma.certificate.count.mockResolvedValue(1);
      mockPrisma.certificate.aggregate.mockResolvedValue({ _sum: { downloadCount: 5 } } as any);

      const result = await service.getOverview('tenant-123');

      expect(result.events.total).toBe(3);
      expect(result.events.published).toBe(2);
      expect(result.registrations.total).toBe(4);
      expect(result.registrations.confirmed).toBe(2);
      expect(result.checkins.total).toBe(1);
      expect(result.checkins.rate).toBe(50); // 1 checkin / 2 confirmed
      expect(result.certificates.issued).toBe(1);
      expect(result.certificates.downloaded).toBe(5);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'dashboard:overview:tenant-123',
        JSON.stringify(result),
        300
      );
    });
  });

  describe('getEventStats', () => {
    it('evento não pertence ao tenant ou não existe → erro NotFoundException', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.getEventStats('event-123', 'tenant-123')).rejects.toThrow(
        NotFoundException
      );
    });

    it('evento válido → calcula timeline, status, checkins e presença', async () => {
      const mockEvent = { id: 'event-123', tenantId: 'tenant-123' };
      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);

      // Registrations over last 30 days
      const mockRegs = [
        { createdAt: new Date(), status: RegistrationStatus.CONFIRMED },
        { createdAt: new Date(), status: RegistrationStatus.CONFIRMED },
        { createdAt: new Date(), status: RegistrationStatus.WAITLIST },
      ];
      mockPrisma.registration.findMany.mockResolvedValue(mockRegs);

      // Check-ins
      const mockCheckins = [
        { checkedInAt: new Date() },
      ];
      mockPrisma.checkIn.findMany.mockResolvedValue(mockCheckins);

      const result = await service.getEventStats('event-123', 'tenant-123');

      expect(result.attendanceRate).toBe(50.0); // 1 check-in / 2 confirmed
      expect(result.statusDistribution).toContainEqual({ status: 'CONFIRMED', count: 2 });
      expect(result.statusDistribution).toContainEqual({ status: 'WAITLIST', count: 1 });
      expect(result.registrationsOverTime.length).toBe(30);
      expect(result.checkinsByHour.length).toBe(24);
    });
  });
});
