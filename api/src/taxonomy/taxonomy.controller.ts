import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('taxonomy')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('categories')
  @RequirePermission('brand.read')
  categories(@CurrentUser() user: TenantUser) {
    return this.taxonomyService.categories(user.organisationId);
  }

  @Get('countries')
  @RequirePermission('brand.read')
  countries(@CurrentUser() user: TenantUser) {
    return this.taxonomyService.countries(user.organisationId);
  }

  @Get('material-presets')
  @RequirePermission('brand.read')
  materialPresets(@CurrentUser() user: TenantUser) {
    return this.taxonomyService.materialPresets(user.organisationId);
  }
}
