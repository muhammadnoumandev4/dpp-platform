import { validateEnvironment } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://dpp:dpp@localhost:5432/dpp',
  JWT_SECRET: 'a-secure-test-secret-that-is-long-enough',
};

describe('validateEnvironment Redis configuration', () => {
  it('accepts Redis TLS URLs and safe namespaces', () => {
    expect(
      validateEnvironment({
        ...base,
        REDIS_URL: 'rediss://default:secret@example.test:25061',
        REDIS_KEY_PREFIX: 'dpp:test:',
        CACHE_MAX_MEMORY_ENTRIES: '500',
      }),
    ).toBeDefined();
  });

  it('rejects non-Redis connection URLs', () => {
    expect(() => validateEnvironment({ ...base, REDIS_URL: 'https://example.test' })).toThrow(
      'REDIS_URL must use redis:// or rediss://',
    );
  });

  it('rejects invalid split configuration values', () => {
    expect(() => validateEnvironment({ ...base, REDIS_PORT: '70000' })).toThrow('REDIS_PORT');
    expect(() => validateEnvironment({ ...base, REDIS_TLS: 'sometimes' })).toThrow('REDIS_TLS');
  });
});
