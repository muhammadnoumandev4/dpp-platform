import { BadRequestException } from '@nestjs/common';

export function assertUploadKey(organisationId: string, purpose: 'image' | 'document', key?: string) {
  if (!key) return;
  const prefix = `${organisationId}/${purpose}/`;
  if (!key.startsWith(prefix) || !/^[a-zA-Z0-9/_-]+\.[a-z0-9]+$/.test(key)) {
    throw new BadRequestException('Upload key does not belong to this organisation or purpose.');
  }
}
