import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Injectable({ scope: Scope.REQUEST })
export abstract class TenantBaseRepository {
  constructor(
    @Inject(REQUEST) protected readonly request: any,
  ) {}

  protected get tenantId(): string {
    const tenantId = this.request.tenantId;
    if (!tenantId) {
      throw new Error('Tenant isolation error: Tenant ID is not set in request context');
    }
    return tenantId;
  }

  /**
   * Enforces tenantId on query parameters
   */
  protected withTenant<W extends { tenantId?: string }>(where: W): W & { tenantId: string } {
    return {
      ...where,
      tenantId: this.tenantId,
    };
  }
}
