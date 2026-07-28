import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertUploadKey } from './upload.utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductCertificationsService {
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

  async addCertification(
    organisationId: string,
    productId: string,
    data: { name: string; issuingAuthority?: string; issueDate?: string; expiryDate?: string; fileKey?: string; fileName?: string },
    actorId: string,
  ) {
    await this.assertProductOwnership(organisationId, productId);
    assertUploadKey(organisationId, 'document', data.fileKey);
    if (data.issueDate && data.expiryDate && new Date(data.expiryDate) < new Date(data.issueDate)) {
      throw new BadRequestException('Expiry date must be on or after the issue date.');
    }
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.certification.count({ where: { productId } });
      const certification = await tx.certification.create({
        data: {
          productId,
          name: data.name,
          issuingAuthority: data.issuingAuthority,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          fileKey: data.fileKey,
          fileName: data.fileName,
          sortOrder: count,
        },
      });
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'CERTIFICATION_ADDED',
          entityType: 'Product',
          entityId: productId,
          diff: { certificationId: certification.id, name: certification.name },
        },
        tx,
      );
      return certification;
    });
  }

  async removeCertification(organisationId: string, productId: string, certificationId: string, actorId: string) {
    await this.assertProductOwnership(organisationId, productId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.certification.deleteMany({ where: { id: certificationId, productId } });
      if (count === 0) {
        throw new NotFoundException('Certification not found.');
      }
      await this.touchProduct(tx, productId);
      await this.audit.log(
        {
          organisationId,
          actorId,
          action: 'CERTIFICATION_REMOVED',
          entityType: 'Product',
          entityId: productId,
          diff: { certificationId },
        },
        tx,
      );
    });
    return { success: true };
  }
}
