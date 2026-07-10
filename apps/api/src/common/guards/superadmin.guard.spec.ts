import { SuperadminGuard } from './superadmin.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('SuperadminGuard', () => {
  let guard: SuperadminGuard;

  beforeEach(() => {
    guard = new SuperadminGuard();
  });

  const createMockContext = (email?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: email ? { email } : null,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('deve permitir acesso para valterpcjr@gmail.com', () => {
    const context = createMockContext('valterpcjr@gmail.com');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve lançar ForbiddenException para outro email', () => {
    const context = createMockContext('outro@test.com');
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('deve lançar ForbiddenException para usuário não autenticado', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
