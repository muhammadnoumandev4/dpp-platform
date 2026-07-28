import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { getPermissions } from './permissions';
import { Role } from '@prisma/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Resolve permissions from role if not explicitly present on the user object
    // (JWT payload might contain role only)
    const userPermissions = getPermissions(user.role as Role);

    const hasPermission = requiredPermissions.every((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException(`Requires permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
