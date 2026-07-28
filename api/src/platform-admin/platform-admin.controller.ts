import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListBrandsQueryDto, PlatformListQueryDto, SetBrandStatusDto } from './dto/platform-admin.dto';
import { PlatformAdminService } from './platform-admin.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { User } from '@prisma/client';

@ApiTags('platform-admin')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get('overview')
  @RequirePermission('platform.read')
  @ApiOperation({ summary: 'Get platform-wide brand, product, passport, and scan totals' })
  overview() {
    return this.platformAdmin.overview();
  }

  @Get('analytics')
  @RequirePermission('platform.read')
  @ApiOperation({ summary: 'Get platform-wide scan trend charts, top brands, and country breakdowns' })
  analytics() {
    return this.platformAdmin.getAnalytics();
  }

  @Get('brands')
  @RequirePermission('brands.manage')
  @ApiOperation({ summary: 'List every customer brand with platform-wide operational totals' })
  listBrands(@Query() query: ListBrandsQueryDto) {
    return this.platformAdmin.listBrands(query);
  }

  @Get('brands/:id')
  @RequirePermission('brands.manage')
  getBrand(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformAdmin.getBrand(id);
  }

  @Patch('brands/:id/status')
  @RequirePermission('brands.manage')
  @ApiOperation({ summary: 'Suspend or reactivate a customer brand' })
  setBrandStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBrandStatusDto,
  ) {
    return this.platformAdmin.setBrandStatus(id, dto.active, user.id);
  }

  @Get('passports')
  @RequirePermission('platform.read')
  @ApiOperation({ summary: 'Cross-tenant passports oversight' })
  listPassports(@Query() query: PlatformListQueryDto) {
    return this.platformAdmin.listPassports(query.search, query.page, query.limit);
  }

  @Get('scans')
  @RequirePermission('platform.read')
  @ApiOperation({ summary: 'Platform-wide scan history stream' })
  listScans(@Query() query: PlatformListQueryDto) {
    return this.platformAdmin.listScans(query.page, query.limit);
  }

  @Get('audit-logs')
  @RequirePermission('platform.read')
  @ApiOperation({ summary: 'Platform-wide audit log history' })
  listAuditLogs(@Query() query: PlatformListQueryDto) {
    return this.platformAdmin.listAuditLogs(query.page, query.limit);
  }
}
