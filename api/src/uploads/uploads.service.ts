import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { DOCUMENT_KINDS, IMAGE_KINDS, detectFileSignature } from './file-signature';
import { OBJECT_STORAGE, ObjectStorage } from './storage/object-storage.interface';

export type UploadPurpose = 'image' | 'document';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

@Injectable()
export class UploadsService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly prisma: PrismaService,
  ) {}

  async upload(buffer: Buffer, originalName: string, purpose: UploadPurpose, organisationId: string) {
    const signature = detectFileSignature(buffer);
    if (!signature) {
      throw new BadRequestException('File content did not match a supported image or document format.');
    }

    const allowedKinds = purpose === 'image' ? IMAGE_KINDS : DOCUMENT_KINDS;
    if (!allowedKinds.includes(signature.kind)) {
      throw new BadRequestException(
        `File content is ${signature.kind}, which is not allowed for purpose "${purpose}" (allowed: ${allowedKinds.join(', ')}).`,
      );
    }

    if (signature.kind === 'docx' && !originalName.toLowerCase().endsWith('.docx')) {
      throw new BadRequestException('File extension does not match its content.');
    }

    const key = `${organisationId}/${purpose}/${randomUUID()}.${signature.extension}`;
    const contentType = CONTENT_TYPE_BY_EXTENSION[signature.extension];
    await this.storage.put({ buffer, key, contentType });

    return { key, url: this.storage.getPublicUrl(key), contentType, size: buffer.length, fileName: originalName };
  }

  urlForKey(key: string): string {
    return this.storage.getPublicUrl(key);
  }

  async cleanup(key: string, organisationId: string): Promise<{ success: true }> {
    const prefix = `${organisationId}/`;
    if (!key.startsWith(prefix) || !/^[a-zA-Z0-9/_-]+\.[a-z0-9]+$/.test(key)) {
      throw new BadRequestException('Invalid upload key.');
    }
    const [image, document, certification, organisation, passportVersion] = await Promise.all([
      this.prisma.productImage.findFirst({
        where: { fileKey: key, product: { organisationId } },
        select: { id: true },
      }),
      this.prisma.document.findFirst({
        where: { fileKey: key, product: { organisationId } },
        select: { id: true },
      }),
      this.prisma.certification.findFirst({
        where: { fileKey: key, product: { organisationId } },
        select: { id: true },
      }),
      this.prisma.organisation.findFirst({
        where: { id: organisationId, logoUrl: { endsWith: `/uploads/${key}` } },
        select: { id: true },
      }),
      this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT pv.id
        FROM passport_versions pv
        JOIN passports pa ON pa.id = pv."passportId"
        JOIN products p ON p.id = pa."productId"
        WHERE p."organisationId" = ${organisationId}
          AND strpos(pv.snapshot::text, ${key}) > 0
        LIMIT 1
      `),
    ]);

    if (image || document || certification || organisation || passportVersion.length > 0) {
      throw new ConflictException('This upload is already referenced and cannot be cleaned up.');
    }

    await this.storage.delete(key);
    return { success: true };
  }
}
