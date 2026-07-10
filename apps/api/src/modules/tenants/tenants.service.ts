import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TenantRole } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  private async createAuditLog(
    userId: string | null,
    action: string,
    resource: string,
    resourceId: string | null,
    metadata: any,
    ip?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          metadata: metadata || {},
          ip: ip || null,
          userAgent: userAgent || null,
        },
      });
    } catch (error) {
      console.error('Erro ao salvar AuditLog em TenantsService:', error);
    }
  }

  async create(createTenantDto: CreateTenantDto, userId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: createTenantDto.slug },
    });

    if (existing) {
      throw new ConflictException('Tenant com este slug já existe.');
    }

    // Create Tenant and Owner membership in a transaction
    const tenant = await this.prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: createTenantDto.name,
          slug: createTenantDto.slug,
        },
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: newTenant.id,
          userId,
          role: TenantRole.OWNER,
        },
      });

      return newTenant;
    });

    await this.createAuditLog(userId, 'CREATE_TENANT', 'tenant', tenant.id, {}, ip, userAgent);

    return tenant;
  }

  async findOne(id: string) {
    const cacheKey = `tenant:${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    await this.redisService.set(cacheKey, JSON.stringify(tenant), 600); // 10 minutos

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto, userId: string, ip?: string, userAgent?: string) {
    const tenant = await this.findOne(id);

    const updatedTenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: updateTenantDto.name,
        logoUrl: updateTenantDto.logoUrl,
        isActive: updateTenantDto.isActive,
        certificateTitle: updateTenantDto.certificateTitle,
        certificateBody: updateTenantDto.certificateBody,
        certificateHours: updateTenantDto.certificateHours,
        certificateSigner: updateTenantDto.certificateSigner,
        certificateSignerUrl: updateTenantDto.certificateSignerUrl,
      },
    });

    await this.redisService.del(`tenant:${id}`);

    await this.createAuditLog(userId, 'UPDATE_TENANT', 'tenant', id, updateTenantDto, ip, userAgent);

    return updatedTenant;
  }

  async findMembers(id: string) {
    await this.findOne(id); // Validate tenant exists

    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
      createdAt: m.createdAt,
    }));
  }

  async addMember(id: string, addMemberDto: AddMemberDto, executorUserId: string, ip?: string, userAgent?: string) {
    const tenant = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { email: addMemberDto.email },
    });

    if (!user) {
      throw new NotFoundException('Usuário com este e-mail não está cadastrado na plataforma.');
    }

    const existingMembership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: id,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('Usuário já é membro deste tenant.');
    }

    const membership = await this.prisma.tenantMembership.create({
      data: {
        tenantId: id,
        userId: user.id,
        role: addMemberDto.role,
      },
    });

    // Enqueue email notification via centralized EmailService
    await this.emailService.enqueue({
      tenantId: id,
      to: user.email,
      template: 'invite-member',
      variables: {
        name: user.name,
        tenantName: tenant.name,
        role: addMemberDto.role,
      },
    });

    await this.createAuditLog(
      executorUserId,
      'ADD_MEMBER',
      'tenant_membership',
      membership.id,
      { tenantId: id, userId: user.id, role: addMemberDto.role },
      ip,
      userAgent,
    );

    return membership;
  }

  async updateMember(
    id: string,
    memberUserId: string,
    updateMemberDto: UpdateMemberDto,
    executorUserId: string,
    ip?: string,
    userAgent?: string,
  ) {
    await this.findOne(id); // Validate tenant exists

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: id,
          userId: memberUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membro do tenant não encontrado.');
    }

    // Owner protection: cannot demote the last owner of the tenant
    if (membership.role === TenantRole.OWNER && updateMemberDto.role !== TenantRole.OWNER) {
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId: id, role: TenantRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Não é possível alterar a permissão do único proprietário do tenant.');
      }
    }

    const updated = await this.prisma.tenantMembership.update({
      where: {
        tenantId_userId: {
          tenantId: id,
          userId: memberUserId,
        },
      },
      data: { role: updateMemberDto.role },
    });

    await this.createAuditLog(
      executorUserId,
      'UPDATE_MEMBER',
      'tenant_membership',
      membership.id,
      { tenantId: id, userId: memberUserId, oldRole: membership.role, newRole: updateMemberDto.role },
      ip,
      userAgent,
    );

    return updated;
  }

  async removeMember(id: string, memberUserId: string, executorUserId: string, ip?: string, userAgent?: string) {
    await this.findOne(id);

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: id,
          userId: memberUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membro do tenant não encontrado.');
    }

    // Owner protection
    if (membership.role === TenantRole.OWNER) {
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId: id, role: TenantRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Não é possível remover o único proprietário do tenant.');
      }
    }

    await this.prisma.tenantMembership.delete({
      where: {
        tenantId_userId: {
          tenantId: id,
          userId: memberUserId,
        },
      },
    });

    await this.createAuditLog(
      executorUserId,
      'REMOVE_MEMBER',
      'tenant_membership',
      membership.id,
      { tenantId: id, userId: memberUserId },
      ip,
      userAgent,
    );

    return { success: true };
  }

  async getMyTenants(userId: string) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId },
      include: {
        tenant: true,
      },
    });

    return memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      logoUrl: m.tenant.logoUrl,
      isActive: m.tenant.isActive,
      role: m.role,
    }));
  }
}
