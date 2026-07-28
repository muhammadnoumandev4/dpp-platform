import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalDiskStorageService } from './local-disk-storage.service';

describe('LocalDiskStorageService', () => {
  let root: string;
  let service: LocalDiskStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dpp-storage-'));
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'UPLOAD_DIR') return root;
        if (key === 'PUBLIC_BASE_URL') return 'https://api.example.test';
        return undefined;
      }),
    };
    service = new LocalDiskStorageService(config as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes a tenant-scoped key and refuses to overwrite it', async () => {
    const key = 'org-1/image/file.png';
    await service.put({ key, buffer: Buffer.from('first'), contentType: 'image/png' });
    await expect(service.put({ key, buffer: Buffer.from('second'), contentType: 'image/png' })).rejects.toThrow();
    await expect(readFile(join(root, key), 'utf8')).resolves.toBe('first');
  });

  it('reads back a written object', async () => {
    const key = 'org-1/image/readable.png';
    await service.put({ key, buffer: Buffer.from('payload'), contentType: 'image/png' });
    await expect(service.read(key)).resolves.toEqual(Buffer.from('payload'));
  });

  it.each(['../escape.pdf', '/tmp/escape.pdf', 'org-1/../../escape.pdf'])(
    'rejects path traversal key %s',
    async (key) => {
      await expect(
        service.put({ key, buffer: Buffer.from('data'), contentType: 'application/pdf' }),
      ).rejects.toThrow();
    },
  );
});
