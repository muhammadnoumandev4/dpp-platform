import { CacheService } from './cache.service';

describe('CacheService memory fallback', () => {
  const previousRedisEnv = { ...process.env };

  beforeEach(() => {
    for (const key of ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_USERNAME', 'REDIS_PASSWORD']) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = previousRedisEnv;
  });

  it('loads once and returns the cached value', async () => {
    const cache = new CacheService();
    const loader = jest.fn().mockResolvedValue({ value: 1 });

    await expect(cache.getOrSet('key', 60, loader)).resolves.toEqual({ value: 1 });
    await expect(cache.getOrSet('key', 60, loader)).resolves.toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates a key prefix', async () => {
    const cache = new CacheService();
    const loader = jest.fn().mockResolvedValue('first');
    await cache.getOrSet('passport:one', 60, loader);
    await cache.deletePrefix('passport:');
    loader.mockResolvedValue('second');
    await expect(cache.getOrSet('passport:one', 60, loader)).resolves.toBe('second');
  });

  it('coalesces concurrent cache misses', async () => {
    const cache = new CacheService();
    const loader = jest.fn(async () => {
      await Promise.resolve();
      return { value: 1 };
    });

    await expect(
      Promise.all([
        cache.getOrSet('passport:burst', 60, loader),
        cache.getOrSet('passport:burst', 60, loader),
        cache.getOrSet('passport:burst', 60, loader),
      ]),
    ).resolves.toEqual([{ value: 1 }, { value: 1 }, { value: 1 }]);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
