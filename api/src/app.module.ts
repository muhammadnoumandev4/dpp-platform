import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { validateEnvironment } from './common/config/env.validation';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { ProductsModule } from './products/products.module';
import { PassportsModule } from './passports/passports.module';
import { QrModule } from './qr/qr.module';
import { UploadsModule } from './uploads/uploads.module';
import { ScansModule } from './scans/scans.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OrganisationsModule } from './organisations/organisations.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from './cache/cache.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    // A permissive default (100 req/min) applies everywhere; the login and
    // public scan endpoints override it with a much tighter limit via
    // @Throttle since they're both unauthenticated and thus the platform's
    // main brute-force/spam surface.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    CacheModule,
    HealthModule,
    AuthModule,
    PlatformAdminModule,
    UsersModule,
    TaxonomyModule,
    ProductsModule,
    PassportsModule,
    QrModule,
    UploadsModule,
    ScansModule,
    AnalyticsModule,
    OrganisationsModule,
    InvitationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
