import { ConflictException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

function createHarness(referencedImage: { id: string } | null = null) {
  const storage = {
    put: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn((key: string) => `/uploads/${key}`),
  };
  const prisma = {
    productImage: { findFirst: jest.fn().mockResolvedValue(referencedImage) },
    document: { findFirst: jest.fn().mockResolvedValue(null) },
    certification: { findFirst: jest.fn().mockResolvedValue(null) },
    organisation: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  return {
    storage,
    prisma,
    service: new UploadsService(storage as never, prisma as never),
  };
}

describe('UploadsService.cleanup', () => {
  const key = 'org-1/image/9e669c98-8b38-47d1-a9da-b08f654d20c8.png';

  it('refuses to delete an upload referenced by live product data', async () => {
    const { service, storage } = createHarness({ id: 'image-1' });

    await expect(service.cleanup(key, 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced upload owned by the organisation', async () => {
    const { service, storage } = createHarness();

    await expect(service.cleanup(key, 'org-1')).resolves.toEqual({ success: true });
    expect(storage.delete).toHaveBeenCalledWith(key);
  });

  it('treats immutable passport snapshots as references', async () => {
    const { service, prisma, storage } = createHarness();
    prisma.$queryRaw.mockResolvedValue([{ id: 'version-1' }]);

    await expect(service.cleanup(key, 'org-1')).rejects.toBeInstanceOf(ConflictException);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
