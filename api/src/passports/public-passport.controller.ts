import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ScansService } from '../scans/scans.service';
import { ScanQueueService } from '../scans/scan-queue.service';
import { PassportsService } from './passports.service';
import { PassportPdfService } from './passport-pdf.service';

@ApiTags('public-passport')
@Controller('passport')
export class PublicPassportController {
  constructor(
    private readonly passportsService: PassportsService,
    private readonly scansService: ScansService,
    private readonly scanQueue: ScanQueueService,
    private readonly pdf: PassportPdfService,
  ) {}

  @Get('i/:itemUuid')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getPublicItem(
    @Param('itemUuid', ParseUUIDPipe) itemUuid: string,
    @Req() request: Request,
    @Headers('x-scan-id') scanId?: string,
    @Headers('x-scan-source') scanSource?: string,
    @Headers('x-skip-scan') skipScan?: string,
  ) {
    const passport = await this.passportsService.getPublicByItemUuid(itemUuid);
    if (skipScan !== '1') {
      this.enqueueScan(passport.id, request, scanId, itemUuid, scanSource);
    }
    return passport;
  }

  @Post('i/:itemUuid/scan')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async recordItemScan(
    @Param('itemUuid', ParseUUIDPipe) itemUuid: string,
    @Req() request: Request,
    @Headers('x-scan-id') scanId?: string,
    @Headers('x-scan-source') scanSource?: string,
  ) {
    const passport = await this.passportsService.getPublicByItemUuid(itemUuid);
    this.enqueueScan(passport.id, request, scanId, itemUuid, scanSource);
  }

  @Post(':uuid/scan')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async recordScan(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() request: Request,
    @Headers('x-scan-id') scanId?: string,
    @Headers('x-scan-source') scanSource?: string,
  ) {
    const passport = await this.passportsService.getPublicByUuid(uuid);
    this.enqueueScan(passport.id, request, scanId, undefined, scanSource);
  }

  @Get(':uuid/pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async downloadPdf(@Param('uuid', ParseUUIDPipe) uuid: string, @Res() response: Response) {
    const pdf = await this.pdf.generate(uuid);
    response
      .status(200)
      .set({
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="passport-${uuid}.pdf"`,
        'content-length': String(pdf.length),
      })
      .send(pdf);
  }

  @Get(':uuid')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getPublic(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() request: Request,
    @Headers('x-scan-id') scanId?: string,
    @Headers('x-scan-source') scanSource?: string,
    @Headers('x-skip-scan') skipScan?: string,
  ) {
    const passport = await this.passportsService.getPublicByUuid(uuid);
    // SSR / CDN fetches send x-skip-scan: 1 and record via POST .../scan
    // from the browser so client IP/UA stay accurate. Direct curl still counts.
    if (skipScan !== '1') {
      this.enqueueScan(passport.id, request, scanId, undefined, scanSource);
    }
    return passport;
  }

  private enqueueScan(
    passportId: string,
    request: Request,
    scanId?: string,
    productItemId?: string,
    scanSource?: string,
  ) {
    const snapshot = this.scansService.snapshotFromRequest(request);
    this.scanQueue.enqueue(() =>
      this.scansService.recordSnapshot(passportId, snapshot, scanId, productItemId, scanSource),
    );
  }
}
