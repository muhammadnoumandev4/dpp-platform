import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductImagesService } from './product-images.service';
import { ProductCertificationsService } from './product-certifications.service';
import { ProductDocumentsService } from './product-documents.service';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductImagesService,
    ProductCertificationsService,
    ProductDocumentsService,
  ],
  exports: [
    ProductsService,
    ProductImagesService,
    ProductCertificationsService,
    ProductDocumentsService,
  ],
})
export class ProductsModule {}
