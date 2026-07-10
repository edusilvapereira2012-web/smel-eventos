import { Test, TestingModule } from '@nestjs/testing';
import { PermissionGuard } from './permission.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionContext, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockPrisma = {
    tenantMembership: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue({}),
  };

  const createMockExecutionContext = (user?: any, headers: Record<string, string> = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
          url: '/test-route',
          method: 'GET',
          ip: '127.0.0.1',
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should return true if no permission is required', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockExecutionContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if user is not authenticated', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('events.create');
    const context = createMockExecutionContext(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw BadRequestException if X-Tenant-ID header is missing', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('events.create');
    const context = createMockExecutionContext({ id: 'user-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should return true if user is OWNER (owner has all permissions)', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('tenants.update');
    const context = createMockExecutionContext({ id: 'user-1' }, { 'x-tenant-id': 'tenant-1' });
    mockPrisma.tenantMembership.findUnique.mockResolvedValue({ role: TenantRole.OWNER });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should return true if user has required permission (e.g. ADMIN has tenants.update)', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('tenants.update');
    const context = createMockExecutionContext({ id: 'user-1' }, { 'x-tenant-id': 'tenant-1' });
    mockPrisma.tenantMembership.findUnique.mockResolvedValue({ role: TenantRole.ADMIN });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException and log audit if user has insufficient permissions (e.g. MEMBER lacks events.create)', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('events.create');
    const context = createMockExecutionContext({ id: 'user-1' }, { 'x-tenant-id': 'tenant-1' });
    mockPrisma.tenantMembership.findUnique.mockResolvedValue({ role: TenantRole.MEMBER });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      'user-1',
      'AUTHORIZATION_FAILURE',
      'permission',
      'events.create',
      expect.objectContaining({
        tenantId: 'tenant-1',
        role: TenantRole.MEMBER,
      }),
      '127.0.0.1',
      undefined,
    );
  });
});
