import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import { Permission, hasPermission } from './permissions';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required for this resource.');
    }

    // Resolve tenantId
    let tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId && request.tenantId) {
      tenantId = request.tenantId;
    }

    if (!tenantId) {
      throw new BadRequestException('Tenant context missing. X-Tenant-ID header required.');
    }

    // Query TenantMembership to find the user's role in this tenant
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this tenant.');
    }

    const allowed = hasPermission(membership.role, requiredPermission);

    if (!allowed) {
      // Audit authorization failure to the database using AuditLogService
      await this.auditLog.log(
        user.id,
        'AUTHORIZATION_FAILURE',
        'permission',
        requiredPermission,
        {
          tenantId,
          role: membership.role,
          path: request.url,
          method: request.method,
        },
        request.ip,
        request.headers['user-agent'] as string,
      );

      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermission}`,
      );
    }

    return true;
  }
}
