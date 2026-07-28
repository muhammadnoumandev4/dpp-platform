import { readRedisConfig } from './redis-config';

describe('readRedisConfig', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    for (const key of [
      'REDIS_URL',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_USERNAME',
      'REDIS_PASSWORD',
      'REDIS_TLS',
      'REDIS_KEY_PREFIX',
    ]) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = original;
  });

  it('uses an isolated DPP namespace with an explicit URL', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(readRedisConfig()).toEqual({
      url: 'redis://localhost:6379',
      keyPrefix: 'dpp:',
    });
  });

  it('supports NFC Panel-style split TLS configuration and escapes credentials', () => {
    process.env.REDIS_HOST = 'managed.example';
    process.env.REDIS_PORT = '25061';
    process.env.REDIS_USERNAME = 'default';
    process.env.REDIS_PASSWORD = 'p@ss/word';
    process.env.REDIS_TLS = 'true';
    process.env.REDIS_KEY_PREFIX = 'assessment:';

    expect(readRedisConfig()).toEqual({
      url: 'rediss://default:p%40ss%2Fword@managed.example:25061',
      keyPrefix: 'assessment:',
    });
  });
});
