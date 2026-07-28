import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { UpdateOrganisationDto } from './dto/organisation.dto';
import { OrganisationsService } from './organisations.service';

@ApiTags('organisation')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller('organisation')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Get()
  @RequirePermission('brand.read')
  get(@CurrentUser() user: TenantUser) {
    return this.organisationsService.get(user.organisationId);
  }

  @Patch()
  @RequirePermission('brand.manage')
  update(@CurrentUser() user: TenantUser, @Body() dto: UpdateOrganisationDto) {
    return this.organisationsService.update(user.organisationId, user.id, dto);
  }
}
