import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { PassportsService } from './passports.service';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';

@ApiTags('products')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller('products/:id')
export class ProductPublishController {
  constructor(private readonly passportsService: PassportsService) {}

  @Get('publish-status')
  @RequirePermission('products.read')
  getPublishStatus(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passportsService.getPublishStatus(user.organisationId, id);
  }

  @Get('passport-versions')
  @RequirePermission('products.read')
  listVersions(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passportsService.listVersions(user.organisationId, id);
  }

  @Get('passport-versions/:version')
  @RequirePermission('products.read')
  getVersion(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.passportsService.getVersion(user.organisationId, id, version);
  }

  @Post('publish')
  @RequirePermission('products.publish')
  publish(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passportsService.publish(user.organisationId, user.id, id);
  }

  @Post('unpublish')
  @RequirePermission('products.publish')
  unpublish(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passportsService.unpublish(user.organisationId, user.id, id);
  }

  @Get('items')
  @RequirePermission('products.read')
  listItems(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passportsService.listItems(user.organisationId, id);
  }

  @Post('items')
  @RequirePermission('products.update')
  generateItems(
    @CurrentUser() user: TenantUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('count', ParseIntPipe) count: number,
    @Body('batchId') batchId?: string,
  ) {
    const safeCount = Math.min(Math.max(1, count), 100);
    return this.passportsService.generateItems(user.organisationId, id, safeCount, batchId);
  }
}

@ApiTags('passports')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller('passports')
export class PassportsController {
  constructor(private readonly passportsService: PassportsService) {}

  @Get()
  @RequirePermission('products.read')
  list(
    @CurrentUser() user: TenantUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.passportsService.list(user.organisationId, { page, limit });
  }
}
