import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: 'id' | 'object' | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data === 'id') {
      return request.tenantId;
    }
    return request.tenant;
  },
);
