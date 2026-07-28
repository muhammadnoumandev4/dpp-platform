import { BadRequestException, Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermission('products.read')
  dashboard(@CurrentUser() user: TenantUser) {
    return this.analyticsService.dashboard(user.organisationId);
  }

  @Get('analytics')
  @RequirePermission('products.read')
  overview(
    @CurrentUser() user: TenantUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    if (days < 1 || days > 90) {
      throw new BadRequestException('days must be between 1 and 90.');
    }
    return this.analyticsService.overview(user.organisationId, days);
  }
}
