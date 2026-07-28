import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

type Job = () => Promise<void>;

/**
 * Bounded in-process queue so public passport reads never await DB write latency.
 * At higher volume, swap the pump for BullMQ/Redis without changing callers.
 */
@Injectable()
export class ScanQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ScanQueueService.name);
  private readonly queue: Job[] = [];
  private active = 0;
  private readonly concurrency = Number(process.env.SCAN_QUEUE_CONCURRENCY ?? 8);
  private readonly maxQueue = Number(process.env.SCAN_QUEUE_MAX ?? 5_000);
  private dropped = 0;

  enqueue(job: Job): void {
    if (this.queue.length >= this.maxQueue) {
      this.dropped += 1;
      if (this.dropped % 100 === 1) {
        this.logger.warn(`Scan queue full — dropped ${this.dropped} jobs (latest)`);
      }
      return;
    }
    this.queue.push(job);
    this.pump();
  }

  depth(): number {
    return this.queue.length + this.active;
  }

  onModuleDestroy() {
    this.queue.length = 0;
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;
      this.active += 1;
      void job()
        .catch((error: Error) => {
          this.logger.warn(`Scan job failed: ${error.message}`);
        })
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}
