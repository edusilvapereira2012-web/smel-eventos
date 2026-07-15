import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperadminService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async getStats() {
    const [totalTenants, totalUsers, totalEvents, totalRegistrations] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.event.count(),
      this.prisma.registration.count(),
    ]);

    return {
      totalTenants,
      totalUsers,
      totalEvents,
      totalRegistrations,
    };
  }

  async getTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            memberships: true,
            events: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl,
      isActive: t.isActive,
      createdAt: t.createdAt,
      membersCount: t._count.memberships,
      eventsCount: t._count.events,
    }));
  }

  async toggleTenantStatus(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Organização não encontrada.');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: !tenant.isActive },
    });
  }

  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            tenantMemberships: true,
            registrations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      tenantsCount: u._count.tenantMemberships,
      registrationsCount: u._count.registrations,
    }));
  }

  async toggleUserStatus(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
  }

  async getEmailLogs(page: number, limit: number, status?: EmailStatus, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { to: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { template: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmailStats() {
    const counts = await this.prisma.emailLog.groupBy({
      by: ['status'],
      _count: true,
    });

    const stats = {
      sent: 0,
      failed: 0,
      dead: 0,
      pendingInQueue: 0,
    };

    for (const group of counts) {
      if (group.status === EmailStatus.SENT) stats.sent = group._count;
      if (group.status === EmailStatus.FAILED) stats.failed = group._count;
      if (group.status === EmailStatus.DEAD) stats.dead = group._count;
      if (group.status === EmailStatus.PENDING) stats.pendingInQueue = group._count;
    }

    return stats;
  }

  async retryEmail(id: string) {
    const emailLog = await this.prisma.emailLog.findUnique({
      where: { id },
    });

    if (!emailLog) {
      throw new NotFoundException('Log de e-mail não encontrado.');
    }

    const updatedLog = await this.prisma.emailLog.update({
      where: { id },
      data: {
        status: EmailStatus.PENDING,
        attempts: 0,
        lastError: null,
      },
    });

    await this.emailQueue.add(
      updatedLog.template,
      { emailLogId: updatedLog.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );

    return {
      message: 'E-mail reenviado com sucesso para a fila.',
      log: updatedLog,
    };
  }
}

