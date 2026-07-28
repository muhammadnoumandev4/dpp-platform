export interface RedisConfig {
  url: string;
  keyPrefix: string;
}

function value(name: string) {
  return (process.env[name] ?? '').trim();
}

/**
 * Accepts both a connection URL and the split environment convention used by
 * NFC Panel. A mandatory application prefix makes sharing one managed Redis
 * instance safe without dashboard/passport keys colliding across products.
 */
export function readRedisConfig(): RedisConfig | null {
  const keyPrefix = value('REDIS_KEY_PREFIX') || 'dpp:';
  const explicitUrl = value('REDIS_URL');
  if (explicitUrl) return { url: explicitUrl, keyPrefix };

  const host = value('REDIS_HOST');
  if (!host) return null;

  const port = value('REDIS_PORT') || '6379';
  const username = value('REDIS_USERNAME');
  const password = value('REDIS_PASSWORD');
  const tls = ['true', '1'].includes(value('REDIS_TLS').toLowerCase());
  const credentials = password
    ? `${encodeURIComponent(username || 'default')}:${encodeURIComponent(password)}@`
    : username
      ? `${encodeURIComponent(username)}@`
      : '';

  return {
    url: `${tls ? 'rediss' : 'redis'}://${credentials}${host}:${port}`,
    keyPrefix,
  };
}
