import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Rejects platform staff (and any principal without a tenant) from brand-scoped
 * routes. Permissions alone are not enough: ADMIN has no tenant permissions by
 * design, but several controllers previously ran with only AuthGuard and would
 * call services with `organisationId = null`.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.organisationId) {
      throw new ForbiddenException('This endpoint requires a brand account.');
    }
    return true;
  }
}
