import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { ACCESS_COOKIE } from './auth.types';
import { getPermissions } from './permissions';
import { Role } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => request?.cookies?.[ACCESS_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.get<string>('JWT_SECRET') as string,
      issuer: 'notarify-dpp-platform',
      audience: 'notarify-dpp-platform-clients',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organisation: { select: { disabledAt: true } } },
    });
    if (!user || user.disabledAt || (user.organisation && user.organisation.disabledAt)) {
      throw new UnauthorizedException();
    }
    const { passwordHash, organisation, ...safeUser } = user;
    return { ...safeUser, permissions: getPermissions(user.role as Role) };
  }
}
