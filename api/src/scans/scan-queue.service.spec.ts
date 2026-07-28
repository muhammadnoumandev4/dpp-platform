import { ScanQueueService } from './scan-queue.service';

describe('ScanQueueService', () => {
  it('runs jobs up to concurrency and drains the queue', async () => {
    const queue = new ScanQueueService();
    const order: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    queue.enqueue(async () => {
      await gate;
      order.push(1);
    });
    queue.enqueue(async () => {
      order.push(2);
    });

    expect(queue.depth()).toBeGreaterThanOrEqual(1);
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(order).toEqual(expect.arrayContaining([1, 2]));
    expect(queue.depth()).toBe(0);
  });

  it('drops jobs when the bounded queue is full', () => {
    process.env.SCAN_QUEUE_MAX = '1';
    process.env.SCAN_QUEUE_CONCURRENCY = '0';
    const queue = new ScanQueueService();
    // concurrency 0 means nothing pumps — first job sits in queue, second is dropped.
    // Re-read: concurrency 0 means while (active < 0) never runs — jobs accumulate until max.
    queue.enqueue(async () => undefined);
    queue.enqueue(async () => undefined);
    expect(queue.depth()).toBe(1);
    delete process.env.SCAN_QUEUE_MAX;
    delete process.env.SCAN_QUEUE_CONCURRENCY;
  });
});
