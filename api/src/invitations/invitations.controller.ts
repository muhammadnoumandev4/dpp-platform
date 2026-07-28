import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@RequirePermission('users.manage')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  list(@CurrentUser() user: TenantUser) {
    return this.invitationsService.list(user.organisationId);
  }

  @Post()
  create(@CurrentUser() user: TenantUser, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.create(user.organisationId, user.id, dto);
  }
}

@ApiTags('invitations')
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.invitationsService.getByToken(token);
  }

  @Post(':token/accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(token, dto);
  }
}
