import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TenantUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { AuditService } from './audit.service';

class AuditQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Inclusive lower bound for createdAt (ISO-8601). Used by the Activity date range. */
  @IsOptional()
  @IsISO8601()
  since?: string;
}

@ApiTags('audit-log')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@RequirePermission('audit.read')
@Controller('audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: TenantUser, @Query() query: AuditQueryDto) {
    return this.audit.list(user.organisationId, {
      cursor: query.cursor,
      limit: query.limit,
      since: query.since ? new Date(query.since) : undefined,
    });
  }
}
