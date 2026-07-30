import { Request } from 'express';
import { createHmac } from 'crypto';
import { ScansService } from './scans.service';

describe('ScansService.record', () => {
  const jwtSecret = 'change-me-in-production-please-generate-a-real-secret';

  function buildService(prisma: {
    scan: { create: jest.Mock };
    passport?: { findUnique: jest.Mock };
  }) {
    const config = {
      get: (key: string) => {
        if (key === 'JWT_SECRET') return jwtSecret;
        if (key === 'TRUST_PROXY') return undefined;
        return undefined;
      },
    };
    const cache = {
      deletePrefix: jest.fn().mockResolvedValue(undefined),
    };
    if (!prisma.passport) {
      prisma.passport = {
        findUnique: jest.fn().mockResolvedValue({
          product: { organisationId: 'org-1' },
        }),
      };
    }
    return new ScansService(prisma as never, config as never, cache as never);
  }

  it('uses Express trusted-proxy IP and creates a keyed HMAC dedup key', async () => {
    const prisma = { scan: { create: jest.fn().mockResolvedValue({}) } };
    const service = buildService(prisma);
    const request = {
      ip: '203.0.113.42',
      headers: {
        'x-forwarded-for': '198.51.100.9',
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'en-GB,en;q=0.9',
      },
    } as unknown as Request;

    await service.record('passport-1', request, '83f144f2-4dab-40bc-b5b7-09fd0dc12140');

    const expectedIpHash = createHmac('sha256', jwtSecret).update('203.0.113.42').digest('hex');
    const expectedDedup = createHmac('sha256', jwtSecret)
      .update('passport-1:83f144f2-4dab-40bc-b5b7-09fd0dc12140')
      .digest('hex');

    expect(prisma.scan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        passportId: 'passport-1',
        ipHash: expectedIpHash,
        ipTruncated: '203.0.113.xxx',
        browserLanguage: 'en-GB',
        dedupKey: expectedDedup,
        source: 'DIRECT',
      }),
    });
  });

  it('ignores forged x-country-code headers when TRUST_PROXY is unset', async () => {
    const prisma = { scan: { create: jest.fn().mockResolvedValue({}) } };
    const service = buildService(prisma);
    const request = {
      ip: '127.0.0.1',
      headers: {
        'x-country-code': 'US',
        'accept-language': 'it-IT',
      },
    } as unknown as Request;

    await service.record('passport-1', request);

    expect(prisma.scan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ country: 'IT' }),
    });
  });

  it('records a QR source only for the exact qr marker', async () => {
    const prisma = { scan: { create: jest.fn().mockResolvedValue({}) } };
    const service = buildService(prisma);
    const request = { ip: '', headers: {} } as unknown as Request;

    await service.record('passport-1', request, undefined, undefined, 'qr');
    await service.record('passport-1', request, undefined, undefined, 'QR-forged');

    expect(prisma.scan.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ source: 'QR' }),
    });
    expect(prisma.scan.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ source: 'DIRECT' }),
    });
  });

  it('does not deduplicate a request with an invalid client scan id', async () => {
    const prisma = { scan: { create: jest.fn().mockResolvedValue({}) } };
    const service = buildService(prisma);
    const request = { ip: '', headers: {} } as unknown as Request;

    await service.record('passport-1', request, '../../bad');

    expect(prisma.scan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dedupKey: null }),
    });
  });
});
