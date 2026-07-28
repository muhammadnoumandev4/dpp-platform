import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { OBJECT_STORAGE, ObjectStorage } from '../uploads/storage/object-storage.interface';

@Injectable()
export class QrService {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async generateForUrl(url: string, organisationId: string): Promise<{ key: string; url: string }> {
    // Server-generated, not user-uploaded — bypasses the upload MIME/purpose
    // policy in UploadsService intentionally, since there's no untrusted
    // input here beyond the URL we already built ourselves.
    const buffer = await QRCode.toBuffer(url, { width: 512, margin: 2 });
    const key = `${organisationId}/qr/${randomUUID()}.png`;
    await this.storage.put({ buffer, key, contentType: 'image/png' });
    return { key, url: this.storage.getPublicUrl(key) };
  }

  deleteGenerated(key: string): Promise<void> {
    return this.storage.delete(key);
  }
}
