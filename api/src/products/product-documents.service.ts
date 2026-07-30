import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertUploadKey } from './upload.utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertProductOwnership(organisationId: string, id: string) {
    const exists = await this.prisma.product.count({ where: { id, organisationId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Product not found.');
  }

  private touchProduct(tx: Prisma.TransactionClient, productId: string) {
    return tx.product.update({ where: { id: productId }, data: { updatedAt: new Date() } });
  }

  async addDocument(
    organisationId: string,
    productId: string,
    data: { type: 'MANUAL' | 'WARRANTY' | 'DATASHEET'; fileKey: string; fileName: string; sizeBytes: number },
    actorId: string,
  ) {
    await this.assertProductOwnership(organisationId, productId);
    assertUploadKey(organisationId, 'document', data.fileKey);
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.document.count({ where: { productId } });
      const document = await tx.document.create({ data: { productId, ...data, sortOrder: count } });
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'DOCUMENT_ADDED',
          entityType: 'Product',
          entityId: productId,
          diff: { documentId: document.id, type: document.type, fileName: document.fileName },
        },
        tx,
      );
      return document;
    });
  }

  async removeDocument(organisationId: string, productId: string, documentId: string, actorId: string) {
    await this.assertProductOwnership(organisationId, productId);
    await this.prisma.$transaction(async (tx) => {
      // Captured before the delete so the activity feed can name the document.
      const document = await tx.document.findFirst({
        where: { id: documentId, productId },
        select: { fileName: true, type: true },
      });
      const { count } = await tx.document.deleteMany({ where: { id: documentId, productId } });
      if (count === 0) {
        throw new NotFoundException('Document not found.');
      }
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'DOCUMENT_REMOVED',
          entityType: 'Product',
          entityId: productId,
          diff: { documentId, fileName: document?.fileName ?? null, type: document?.type ?? null },
        },
        tx,
      );
    });
    return { success: true };
  }
}
