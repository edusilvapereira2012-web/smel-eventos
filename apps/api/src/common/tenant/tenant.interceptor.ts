import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SKIP_TENANT_KEY } from './skip-tenant.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Check if route is marked to skip tenant validation
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenant) {
      return next.handle();
    }

    // Try to get tenantId from headers first
    let tenantId = request.headers['x-tenant-id'] as string;

    // Fallback: Check JWT user payload if user is authenticated
    if (!tenantId && request.user && request.user.tenantId) {
      tenantId = request.user.tenantId;
    }

    if (!tenantId) {
      throw new BadRequestException(
        'Tenant context missing. Please provide X-Tenant-ID header or authenticate.',
      );
    }

    const cacheKey = `tenant:${tenantId}`;
    let tenantData: any = null;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        tenantData = JSON.parse(cached);
      }
    } catch (err) {
      // Fallback silently to DB if Redis is unavailable
    }

    if (tenantData) {
      if (!tenantData.isActive) {
        throw new ForbiddenException('Tenant is inactive.');
      }
    } else {
      // Fetch from Database
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found.');
      }

      tenantData = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
      };

      try {
        // Cache for 5 minutes (300 seconds)
        await this.redis.set(cacheKey, JSON.stringify(tenantData), 300);
      } catch (err) {
        // Cache set failure safety
      }

      if (!tenant.isActive) {
        throw new ForbiddenException('Tenant is inactive.');
      }
    }

    // Bind to request
    request.tenantId = tenantId;
    request.tenant = tenantData;

    return next.handle();
  }
}
