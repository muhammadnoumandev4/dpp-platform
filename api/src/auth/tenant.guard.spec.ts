import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

function mockContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  it('allows a brand user with an organisationId', () => {
    expect(guard.canActivate(mockContext({ organisationId: 'org-1' }))).toBe(true);
  });

  it('rejects platform staff with a null organisationId', () => {
    expect(() => guard.canActivate(mockContext({ organisationId: null, role: 'ADMIN' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an unauthenticated request', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException);
  });
});
