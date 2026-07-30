import { ScanQueueService } from './scan-queue.service';
import { ScanRequestSnapshot } from './scans.service';

function memoryCacheStub() {
  return {
    isRedisConfigured: () => false,
    listPush: jest.fn().mockResolvedValue(false),
    listPop: jest.fn().mockResolvedValue(null),
    listLength: jest.fn().mockResolvedValue(0),
  };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Timed out waiting for condition');
}

describe('ScanQueueService', () => {
  const snapshot: ScanRequestSnapshot = {
    ip: '203.0.113.10',
    userAgent: 'jest',
  };

  afterEach(() => {
    delete process.env.SCAN_QUEUE_MAX;
    delete process.env.SCAN_QUEUE_CONCURRENCY;
  });

  it('runs jobs up to concurrency and drains the queue', async () => {
    const order: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const scans = {
      recordSnapshot: jest.fn(async (passportId: string) => {
        if (passportId === 'a') await gate;
        order.push(passportId === 'a' ? 1 : 2);
      }),
    };

    const queue = new ScanQueueService(memoryCacheStub() as never, scans as never);
    queue.onModuleInit();

    queue.enqueue({ passportId: 'a', snapshot });
    queue.enqueue({ passportId: 'b', snapshot });

    expect(queue.memoryDepth()).toBeGreaterThanOrEqual(1);
    release();
    await waitUntil(() => order.length === 2);
    expect(order).toEqual(expect.arrayContaining([1, 2]));
    expect(scans.recordSnapshot).toHaveBeenCalledTimes(2);
    queue.onModuleDestroy();
  });

  it('drops jobs when the bounded memory queue is full', () => {
    process.env.SCAN_QUEUE_MAX = '1';
    // Construct after env is set — fields are read in the constructor body via Number(...).
    // concurrency stays default; we never start the pump so jobs stay queued.
    const scans = { recordSnapshot: jest.fn().mockResolvedValue(undefined) };
    const queue = new ScanQueueService(memoryCacheStub() as never, scans as never);

    queue.enqueue({ passportId: 'a', snapshot });
    queue.enqueue({ passportId: 'b', snapshot });

    expect(queue.memoryDepth()).toBe(1);
    expect(scans.recordSnapshot).not.toHaveBeenCalled();
    queue.onModuleDestroy();
  });

  it('prefers Redis list when configured', async () => {
    const cache = {
      isRedisConfigured: () => true,
      listPush: jest.fn().mockResolvedValue(true),
      listPop: jest.fn().mockResolvedValue(null),
      listLength: jest.fn().mockResolvedValue(0),
    };
    const scans = { recordSnapshot: jest.fn().mockResolvedValue(undefined) };
    const queue = new ScanQueueService(cache as never, scans as never);

    queue.enqueue({ passportId: 'p1', snapshot, source: 'qr' });
    await waitUntil(() => cache.listPush.mock.calls.length === 1);

    expect(cache.listPush).toHaveBeenCalledWith(
      'scan-jobs',
      expect.stringContaining('"passportId":"p1"'),
    );
    expect(queue.memoryDepth()).toBe(0);
    queue.onModuleDestroy();
  });
});
