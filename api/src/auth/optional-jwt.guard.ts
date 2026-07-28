import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches request.user when a valid JWT is present; never rejects anonymous
 * callers. Used by the media gate so published assets stay public while draft
 * uploads remain tenant-only.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No/invalid token — continue as anonymous.
    }
    return true;
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
