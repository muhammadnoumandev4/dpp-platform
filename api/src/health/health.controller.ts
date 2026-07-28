import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../cache/cache.service';
import { ScanQueueService } from '../scans/scan-queue.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly scanQueue: ScanQueueService,
  ) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const cache = await this.cache.ping();
      return {
        status: 'ok',
        cache,
        scanQueueDepth: this.scanQueue.depth(),
        uptimeSeconds: Math.floor(process.uptime()),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        error: (error as Error).message,
      });
    }
  }
}
