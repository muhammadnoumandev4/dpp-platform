import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { ObjectStorage, PutObjectParams } from './object-storage.interface';

@Injectable()
export class LocalDiskStorageService implements ObjectStorage {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = this.config.get<string>('UPLOAD_DIR') || join(process.cwd(), 'uploads');
    this.publicBaseUrl =
      this.config.get<string>('PUBLIC_BASE_URL') || `http://localhost:${this.config.get('PORT') || 3000}`;
    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
  }

  async put({ buffer, key }: PutObjectParams): Promise<void> {
    const destination = this.resolveKey(key);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: 'wx' });
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  private resolveKey(key: string): string {
    if (!key || isAbsolute(key) || key.includes('\0')) {
      throw new Error('Invalid storage key.');
    }
    const root = resolve(this.rootDir);
    const destination = resolve(root, key);
    const rel = relative(root, destination);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error('Storage key escapes the configured upload directory.');
    }
    return destination;
  }
}
