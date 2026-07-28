import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from './storage/object-storage.interface';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Replaces world-readable static /uploads mounting. Draft assets require a
 * tenant JWT whose organisationId matches the key prefix. Published passport
 * assets (and brand logos referenced by live passports) remain publicly readable.
 */
@ApiTags('uploads')
@Controller('uploads')
export class MediaController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':orgId/:purpose/:filename')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  async serve(
    @Param('orgId') orgId: string,
    @Param('purpose') purpose: string,
    @Param('filename') filename: string,
    @Req() request: Request & { user?: AuthenticatedUser },
    @Res() response: Response,
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(orgId) || !/^[a-z]+$/.test(purpose) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new NotFoundException();
    }

    const key = `${orgId}/${purpose}/${filename}`;
    const allowed = await this.canAccess(key, request.user);
    if (!allowed) {
      throw new ForbiddenException('This file is not publicly available.');
    }

    try {
      const buffer = await this.storage.read(key);
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      const contentType = CONTENT_TYPE_BY_EXTENSION[extension] || 'application/octet-stream';
      response
        .status(200)
        .set({
          'content-type': contentType,
          'cache-control': request.user ? 'private, max-age=60' : 'public, max-age=300',
          'content-length': String(buffer.length),
        })
        .send(buffer);
    } catch {
      throw new NotFoundException();
    }
  }

  private async canAccess(key: string, user?: AuthenticatedUser | null): Promise<boolean> {
    if (user?.organisationId && key.startsWith(`${user.organisationId}/`)) {
      return true;
    }

    const publishedWhere = {
      publishedAt: { not: null },
      unpublishedAt: null,
    } as const;

    const [image, document, certification, passportQr, itemQr, brandLogo] = await Promise.all([
      this.prisma.productImage.findFirst({
        where: { fileKey: key, product: { passport: publishedWhere } },
        select: { id: true },
      }),
      this.prisma.document.findFirst({
        where: { fileKey: key, product: { passport: publishedWhere } },
        select: { id: true },
      }),
      this.prisma.certification.findFirst({
        where: { fileKey: key, product: { passport: publishedWhere } },
        select: { id: true },
      }),
      this.prisma.passport.findFirst({
        where: { qrKey: key, ...publishedWhere },
        select: { id: true },
      }),
      this.prisma.productItem.findFirst({
        where: { qrKey: key, passport: publishedWhere },
        select: { id: true },
      }),
      this.prisma.organisation.findFirst({
        where: {
          OR: [{ logoUrl: { endsWith: `/uploads/${key}` } }, { logoUrl: { endsWith: key } }],
          products: { some: { passport: publishedWhere } },
        },
        select: { id: true },
      }),
    ]);

    return Boolean(image || document || certification || passportQr || itemQr || brandLogo);
  }
}
