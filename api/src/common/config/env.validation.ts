export interface EnvConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT?: string;
  UPLOAD_DIR?: string;
  PUBLIC_BASE_URL?: string;
  CORS_ORIGIN?: string;
  WEB_PUBLIC_URL?: string;
  TRUST_PROXY?: string;
  COOKIE_SECURE?: string;
  SCAN_COUNTRY_FALLBACK?: string;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: string;
  REDIS_KEY_PREFIX?: string;
  CACHE_MAX_MEMORY_ENTRIES?: string;
}

const MIN_JWT_SECRET_LENGTH = 32;

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const jwtSecret = String(config.JWT_SECRET);
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${jwtSecret.length}).`);
  }

  const redisUrl = String(config.REDIS_URL ?? '').trim();
  if (redisUrl) {
    let parsed: URL;
    try {
      parsed = new URL(redisUrl);
    } catch {
      throw new Error('REDIS_URL must be a valid Redis URL');
    }
    if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
      throw new Error('REDIS_URL must use redis:// or rediss://');
    }
  }

  const redisPort = String(config.REDIS_PORT ?? '').trim();
  if (redisPort && (!/^\d+$/.test(redisPort) || Number(redisPort) < 1 || Number(redisPort) > 65_535)) {
    throw new Error('REDIS_PORT must be an integer between 1 and 65535');
  }

  const redisTls = String(config.REDIS_TLS ?? '').trim().toLowerCase();
  if (redisTls && !['true', 'false', '1', '0'].includes(redisTls)) {
    throw new Error('REDIS_TLS must be true or false');
  }

  const redisKeyPrefix = String(config.REDIS_KEY_PREFIX ?? '').trim();
  if (redisKeyPrefix && !/^[A-Za-z0-9:_-]+$/.test(redisKeyPrefix)) {
    throw new Error('REDIS_KEY_PREFIX contains unsupported characters');
  }

  const maxMemoryEntries = String(config.CACHE_MAX_MEMORY_ENTRIES ?? '').trim();
  if (maxMemoryEntries && (!/^\d+$/.test(maxMemoryEntries) || Number(maxMemoryEntries) < 1)) {
    throw new Error('CACHE_MAX_MEMORY_ENTRIES must be a positive integer');
  }

  return config;
}
