import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { readRedisConfig } from './redis-config';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly redis?: Redis;
  private readonly redisKeyPrefix: string;
  private readonly maxMemoryEntries: number;

  constructor() {
    const config = readRedisConfig();
    this.redisKeyPrefix = config?.keyPrefix ?? 'dpp:';
    this.maxMemoryEntries = Math.max(1, Number(process.env.CACHE_MAX_MEMORY_ENTRIES) || 1_000);
    if (config) {
      this.redis = new Redis(config.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (error) => this.logger.warn(`Redis unavailable; using memory fallback: ${error.message}`));
    }
  }

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    // Coalesce concurrent misses in this process. Public QR scans often arrive
    // in bursts; without this guard every miss would execute the same database
    // graph query before the first response has populated Redis.
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const pending = (async () => {
      const value = await loader();
      await this.set(key, value, ttlSeconds);
      return value;
    })();
    this.inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
    }
  }

  async delete(key: string) {
    this.memory.delete(key);
    try {
      if (this.redis) await this.ensureRedis().then((redis) => redis.del(this.redisKey(key)));
    } catch {
      // Memory fallback remains authoritative for this process.
    }
  }

  async deletePrefix(prefix: string) {
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
    try {
      if (this.redis) {
        const redis = await this.ensureRedis();
        let cursor = '0';
        do {
          const [next, keys] = await redis.scan(
            cursor,
            'MATCH',
            `${this.redisKey(prefix)}*`,
            'COUNT',
            100,
          );
          cursor = next;
          if (keys.length) await redis.del(...keys);
        } while (cursor !== '0');
      }
    } catch {
      // Redis failure must never break domain mutations.
    }
  }

  /** Lightweight liveness probe — returns 'memory' when Redis is not configured. */
  async ping(): Promise<'redis' | 'memory'> {
    if (!this.redis) return 'memory';
    const redis = await this.ensureRedis();
    const reply = await redis.ping();
    if (reply !== 'PONG') throw new Error(`Unexpected Redis PING reply: ${reply}`);
    return 'redis';
  }

  async onModuleDestroy() {
    if (this.redis?.status === 'ready') await this.redis.quit();
    else this.redis?.disconnect();
  }

  private async get<T>(key: string): Promise<T | undefined> {
    try {
      if (this.redis) {
        const value = await this.ensureRedis().then((redis) => redis.get(this.redisKey(key)));
        if (value) return JSON.parse(value) as T;
      }
    } catch {
      // Fall through to local cache.
    }
    const local = this.memory.get(key);
    if (!local) return undefined;
    if (local.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return undefined;
    }
    return JSON.parse(local.value) as T;
  }

  private async set(key: string, value: unknown, ttlSeconds: number) {
    const serialized = JSON.stringify(value);
    this.pruneMemory();
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
    try {
      if (this.redis) {
        await this.ensureRedis().then((redis) =>
          redis.set(this.redisKey(key), serialized, 'EX', ttlSeconds),
        );
      }
    } catch {
      // Memory cache already contains the value.
    }
  }

  private async ensureRedis() {
    if (!this.redis) throw new Error('Redis is not configured.');
    if (this.redis.status === 'wait') await this.redis.connect();
    return this.redis;
  }

  private redisKey(key: string) {
    return `${this.redisKeyPrefix}${key}`;
  }

  private pruneMemory() {
    const now = Date.now();
    for (const [key, entry] of this.memory) {
      if (entry.expiresAt <= now) this.memory.delete(key);
    }
    while (this.memory.size >= this.maxMemoryEntries) {
      const oldest = this.memory.keys().next().value as string | undefined;
      if (!oldest) break;
      this.memory.delete(oldest);
    }
  }
}
