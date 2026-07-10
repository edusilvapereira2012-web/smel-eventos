import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperadminService {
  constructor(private readonly prisma: PrismaService) {}

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
}
