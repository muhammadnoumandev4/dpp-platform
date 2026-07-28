import { Controller, Delete, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@RequirePermission('users.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: TenantUser) {
    return this.usersService.list(user.organisationId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TenantUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(user.organisationId, id, user.id);
  }
}
