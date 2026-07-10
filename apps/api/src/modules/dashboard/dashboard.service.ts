import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RegistrationStatus, EventStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(tenantId: string) {
    const cacheKey = `dashboard:overview:${tenantId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Fallback silently if Redis fails
    }

    const now = new Date();

    // 1. Events Counts
    const events = await this.prisma.event.findMany({
      where: { tenantId },
      select: { status: true, startDate: true, endDate: true },
    });

    const eventsStats = {
      total: events.length,
      published: events.filter((e) => e.status === EventStatus.PUBLISHED).length,
      upcoming: events.filter((e) => e.status === EventStatus.PUBLISHED && e.startDate > now).length,
      finished: events.filter((e) => e.status === EventStatus.FINISHED || (e.status === EventStatus.PUBLISHED && e.endDate < now)).length,
    };

    // 2. Registrations Counts
    const registrations = await this.prisma.registration.findMany({
      where: {
        event: { tenantId },
      },
      select: { status: true },
    });

    const regsStats = {
      total: registrations.length,
      confirmed: registrations.filter((r) => r.status === RegistrationStatus.CONFIRMED).length,
      waitlist: registrations.filter((r) => r.status === RegistrationStatus.WAITLIST).length,
      cancelled: registrations.filter((r) => r.status === RegistrationStatus.CANCELLED).length,
    };

    // 3. Check-ins Stats
    const totalCheckins = await this.prisma.checkIn.count({
      where: {
        registration: {
          event: { tenantId },
        },
      },
    });

    const checkinsStats = {
      total: totalCheckins,
      rate: regsStats.confirmed > 0 ? Number(((totalCheckins / regsStats.confirmed) * 100).toFixed(1)) : 0,
    };

    // 4. Certificates Stats
    const totalCertificates = await this.prisma.certificate.count({
      where: {
        registration: {
          event: { tenantId },
        },
      },
    });

    const sumResult = await this.prisma.certificate.aggregate({
      where: {
        registration: {
          event: { tenantId },
        },
      },
      _sum: {
        downloadCount: true,
      },
    });

    const certificatesStats = {
      issued: totalCertificates,
      downloaded: sumResult._sum.downloadCount || 0,
    };

    const overview = {
      events: eventsStats,
      registrations: regsStats,
      checkins: checkinsStats,
      certificates: certificatesStats,
    };

    try {
      // Cache overview for 5 minutes (300 seconds)
      await this.redis.set(cacheKey, JSON.stringify(overview), 300);
    } catch (err) {
      // Fallback silently if Redis set fails
    }

    return overview;
  }

  async getEventStats(eventId: string, tenantId: string) {
    // Verify event belongs to tenant
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    const now = new Date();

    // 1. Registrations over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, status: true },
    });

    // Generate dates map
    const dateMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      dateMap.set(dateStr, 0);
    }

    for (const reg of registrations) {
      const dateStr = reg.createdAt.toISOString().substring(0, 10);
      if (dateMap.has(dateStr)) {
        dateMap.set(dateStr, dateMap.get(dateStr)! + 1);
      }
    }

    const registrationsOverTime = Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // 2. Status distribution
    const allEventRegs = await this.prisma.registration.findMany({
      where: { eventId },
      select: { status: true },
    });

    const statusCounts = {
      CONFIRMED: 0,
      WAITLIST: 0,
      CANCELLED: 0,
      TRANSFERRED: 0,
    };

    for (const reg of allEventRegs) {
      if (reg.status in statusCounts) {
        statusCounts[reg.status as keyof typeof statusCounts]++;
      }
    }

    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // 3. Check-ins by hour
    const checkins = await this.prisma.checkIn.findMany({
      where: { eventId },
      select: { checkedInAt: true },
    });

    const hourMap = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      const hourStr = String(h).padStart(2, '0') + ':00';
      hourMap.set(hourStr, 0);
    }

    for (const ci of checkins) {
      const hour = ci.checkedInAt.getHours();
      const hourStr = String(hour).padStart(2, '0') + ':00';
      if (hourMap.has(hourStr)) {
        hourMap.set(hourStr, hourMap.get(hourStr)! + 1);
      }
    }

    const checkinsByHour = Array.from(hourMap.entries()).map(([hour, count]) => ({
      hour,
      count,
    }));

    // 4. Attendance rate
    const confirmedCount = allEventRegs.filter((r) => r.status === RegistrationStatus.CONFIRMED).length;
    const checkinsCount = checkins.length;
    const attendanceRate = confirmedCount > 0 ? Number(((checkinsCount / confirmedCount) * 100).toFixed(1)) : 0;

    return {
      registrationsOverTime,
      statusDistribution,
      checkinsByHour,
      attendanceRate,
    };
  }
}
