import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertUploadKey } from './upload.utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductImagesService {
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

  async addImage(
    organisationId: string,
    productId: string,
    data: { key: string; isCover?: boolean; altText?: string },
    actorId: string,
  ) {
    await this.assertProductOwnership(organisationId, productId);
    assertUploadKey(organisationId, 'image', data.key);
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.productImage.count({ where: { productId } });
      const isCover = data.isCover ?? count === 0;
      if (isCover) {
        await tx.productImage.updateMany({ where: { productId }, data: { isCover: false } });
      }
      const image = await tx.productImage.create({
        data: { productId, fileKey: data.key, isCover, altText: data.altText, sortOrder: count },
      });
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'IMAGE_ADDED',
          entityType: 'Product',
          entityId: productId,
          diff: { imageId: image.id, isCover: image.isCover },
        },
        tx,
      );
      return image;
    });
  }

  async removeImage(organisationId: string, productId: string, imageId: string, actorId: string) {
    await this.assertProductOwnership(organisationId, productId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.productImage.deleteMany({ where: { id: imageId, productId } });
      if (count === 0) {
        throw new NotFoundException('Image not found.');
      }
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'IMAGE_REMOVED',
          entityType: 'Product',
          entityId: productId,
          diff: { imageId },
        },
        tx,
      );
    });
    return { success: true };
  }

  async setCoverImage(organisationId: string, productId: string, imageId: string, actorId: string) {
    await this.assertProductOwnership(organisationId, productId);
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({ where: { productId, id: { not: imageId } }, data: { isCover: false } });
      const { count } = await tx.productImage.updateMany({ where: { id: imageId, productId }, data: { isCover: true } });
      if (count === 0) {
        throw new NotFoundException('Image not found.');
      }
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'COVER_IMAGE_CHANGED',
          entityType: 'Product',
          entityId: productId,
          diff: { imageId },
        },
        tx,
      );
    });
    return { success: true };
  }
}
