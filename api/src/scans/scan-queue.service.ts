import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { ScansService, ScanRequestSnapshot } from './scans.service';

export interface ScanJobPayload {
  passportId: string;
  snapshot: ScanRequestSnapshot;
  scanId?: string;
  productItemId?: string;
  source?: string;
}

/**
 * Bounded scan writer. Prefers a Redis list so multiple API replicas share one
 * queue; falls back to an in-process deque when Redis is unset or unreachable.
 * Callers always pass a serialisable payload — never a Request / closure.
 */
@Injectable()
export class ScanQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanQueueService.name);
  private readonly memory: ScanJobPayload[] = [];
  private active = 0;
  private concurrency = Number(process.env.SCAN_QUEUE_CONCURRENCY ?? 8);
  private maxQueue = Number(process.env.SCAN_QUEUE_MAX ?? 5_000);
  private dropped = 0;
  private stopped = false;
  private wake: (() => void) | null = null;

  constructor(
    private readonly cache: CacheService,
    private readonly scans: ScansService,
  ) {}

  onModuleInit() {
    void this.loop();
  }

  onModuleDestroy() {
    this.stopped = true;
    this.memory.length = 0;
    this.wake?.();
  }

  enqueue(job: ScanJobPayload): void {
    // Memory path stays synchronous so a single request thread can enqueue
    // without racing the pump on the next microtask.
    if (!this.cache.isRedisConfigured()) {
      this.pushMemory(job);
      return;
    }
    void this.enqueueRedis(job);
  }

  /** Local + Redis depth for health probes (best-effort). */
  async depth(): Promise<number> {
    const remote = await this.cache.listLength(CacheKeys.scanQueue);
    return this.memory.length + this.active + remote;
  }

  /** Sync depth for tests that only exercise the memory path. */
  memoryDepth(): number {
    return this.memory.length + this.active;
  }

  private async enqueueRedis(job: ScanJobPayload) {
    const pushed = await this.cache.listPush(CacheKeys.scanQueue, JSON.stringify(job));
    if (pushed) {
      this.wake?.();
      return;
    }
    this.pushMemory(job);
  }

  private pushMemory(job: ScanJobPayload) {
    if (this.memory.length >= this.maxQueue) {
      this.dropped += 1;
      if (this.dropped % 100 === 1) {
        this.logger.warn(`Scan queue full — dropped ${this.dropped} jobs (latest)`);
      }
      return;
    }
    this.memory.push(job);
    this.wake?.();
  }

  private async loop() {
    while (!this.stopped) {
      while (!this.stopped && this.active < this.concurrency) {
        const job = await this.takeJob();
        if (!job) break;
        this.active += 1;
        void this.scans
          .recordSnapshot(job.passportId, job.snapshot, job.scanId, job.productItemId, job.source)
          .catch((error: Error) => {
            this.logger.warn(`Scan job failed: ${error.message}`);
          })
          .finally(() => {
            this.active -= 1;
            this.wake?.();
          });
      }
      await this.waitForWork();
    }
  }

  private async takeJob(): Promise<ScanJobPayload | null> {
    const fromMemory = this.memory.shift();
    if (fromMemory) return fromMemory;

    if (!this.cache.isRedisConfigured()) return null;
    const raw = await this.cache.listPop(CacheKeys.scanQueue);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ScanJobPayload;
    } catch {
      this.logger.warn('Dropped malformed scan job from Redis list');
      return null;
    }
  }

  private waitForWork() {
    return new Promise<void>((resolve) => {
      this.wake = () => {
        this.wake = null;
        resolve();
      };
      // Idle poll so Redis jobs enqueued by another replica are still drained.
      setTimeout(() => {
        if (this.wake) {
          this.wake = null;
          resolve();
        }
      }, 200);
    });
  }
}
