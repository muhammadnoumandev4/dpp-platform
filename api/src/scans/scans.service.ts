import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { createHmac } from 'crypto';
import { Prisma, ScanSource } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import * as geoip from 'geoip-lite';

/** Captured before the HTTP response ends so queued writes never touch a recycled Request. */
export interface ScanRequestSnapshot {
  ip: string;
  userAgent: string;
  acceptLanguage?: string;
  referrer?: string;
  cfIpCountry?: string;
}

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);
  private readonly ipPepper: string;
  private readonly trustProxyConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Prefer a dedicated pepper; fall back to JWT_SECRET so existing deploys
    // keep working without a new required env var.
    this.ipPepper =
      this.config.get<string>('SCAN_IP_PEPPER') ||
      this.config.get<string>('JWT_SECRET') ||
      'insecure-dev-pepper';
    this.trustProxyConfigured = Boolean(this.config.get<string>('TRUST_PROXY'));
  }

  snapshotFromRequest(request: Request): ScanRequestSnapshot {
    return {
      ip: request.ip || '',
      userAgent: request.headers['user-agent'] || '',
      acceptLanguage: request.headers['accept-language'] as string | undefined,
      referrer: (request.headers['referer'] as string) || undefined,
      cfIpCountry: request.headers['cf-ipcountry'] as string | undefined,
    };
  }

  async record(
    passportId: string,
    request: Request,
    scanId?: string,
    productItemId?: string,
    source?: string,
  ) {
    return this.recordSnapshot(
      passportId,
      this.snapshotFromRequest(request),
      scanId,
      productItemId,
      source,
    );
  }

  async recordSnapshot(
    passportId: string,
    snapshot: ScanRequestSnapshot,
    scanId?: string,
    productItemId?: string,
    source?: string,
  ) {
    try {
      const parsed = new UAParser(snapshot.userAgent).getResult();
      const clientIp = snapshot.ip;
      const acceptLanguage = snapshot.acceptLanguage;
      const safeScanId = scanId && /^[0-9a-f-]{16,64}$/i.test(scanId) ? scanId : undefined;

      const detectedCountry = this.resolveCountry(snapshot, clientIp, acceptLanguage);

      await this.prisma.scan.create({
        data: {
          passportId,
          productItemId,
          source: source === 'qr' ? ScanSource.QR : ScanSource.DIRECT,
          // Keyed HMAC of the full address for opaque correlation/dedup.
          ipHash: clientIp ? createHmac('sha256', this.ipPepper).update(clientIp).digest('hex') : null,
          // Assessment requires recording an IP address. We store a privacy-reduced
          // form (last octet / IPv6 hextets redacted), never the raw address.
          ipTruncated: clientIp ? this.truncateIp(clientIp) : null,
          browser: parsed.browser.name || null,
          os: parsed.os.name || null,
          browserLanguage: acceptLanguage?.split(',')[0] || null,
          country: detectedCountry,
          referrer: snapshot.referrer || null,
          dedupKey: safeScanId
            ? createHmac('sha256', this.ipPepper).update(`${passportId}:${safeScanId}`).digest('hex')
            : null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.debug(`Ignored duplicate scan for passport=${passportId}`);
        return;
      }
      this.logger.warn(`Failed to record scan for passport=${passportId}: ${(error as Error).message}`);
    }
  }

  private resolveCountry(
    snapshot: ScanRequestSnapshot,
    ip: string,
    acceptLanguage?: string,
  ): string {
    // Only trust edge-injected country headers when the process is configured
    // to trust the reverse proxy. Otherwise any client can forge them.
    if (this.trustProxyConfigured) {
      const cfCountry = snapshot.cfIpCountry;
      if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
        return cfCountry.toUpperCase();
      }
    }

    if (ip && !this.isPrivateIp(ip)) {
      const geo = geoip.lookup(ip);
      if (geo?.country) return geo.country.toUpperCase();
    }

    // Assessment allows a mock country; Accept-Language is a best-effort hint,
    // never a security boundary.
    if (acceptLanguage) {
      const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
      if (lang.includes('-')) {
        const region = lang.split('-')[1].toUpperCase();
        if (region.length === 2) return region;
      }
      const langToCountry: Record<string, string> = {
        it: 'IT',
        de: 'DE',
        fr: 'FR',
        es: 'ES',
        pt: 'PT',
        nl: 'NL',
        ru: 'RU',
        ja: 'JP',
        zh: 'CN',
        ar: 'SA',
        ur: 'PK',
      };
      const primaryLang = lang.split('-')[0];
      if (langToCountry[primaryLang]) return langToCountry[primaryLang];
    }

    return process.env.SCAN_COUNTRY_FALLBACK || 'IT';
  }

  private isPrivateIp(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
  }

  private truncateIp(ip: string): string {
    if (ip.includes(':')) {
      const parts = ip.split(':').filter(Boolean);
      return `${parts.slice(0, 4).join(':')}::`;
    }
    return ip.replace(/\.\d+$/, '.xxx');
  }
}
