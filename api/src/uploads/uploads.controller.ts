import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantUser } from '../auth/auth.types';
import { RequirePermission } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { UploadPurpose, UploadsService } from './uploads.service';

const MAX_BYTES = 10 * 1024 * 1024;

class UploadBodyDto {
  @IsIn(['image', 'document'])
  purpose: UploadPurpose;
}

class CleanupUploadDto {
  @IsString()
  key: string;
}

@ApiTags('uploads')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @RequirePermission('products.update')
  @ApiConsumes('multipart/form-data')
  // Multer enforces the size cap while streaming into the buffer, not after
  // the whole file already sits in memory — a request over the limit is
  // rejected mid-upload instead of paying for the allocation first.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() body: UploadBodyDto, @CurrentUser() user: TenantUser) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }
    if (!body.purpose) {
      throw new BadRequestException('purpose ("image" or "document") is required.');
    }
    return this.uploadsService.upload(file.buffer, file.originalname, body.purpose, user.organisationId);
  }

  @Post('cleanup')
  @RequirePermission('products.update')
  cleanup(@Body() body: CleanupUploadDto, @CurrentUser() user: TenantUser) {
    return this.uploadsService.cleanup(body.key, user.organisationId);
  }
}
