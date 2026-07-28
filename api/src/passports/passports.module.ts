import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { QrModule } from '../qr/qr.module';
import { ScansModule } from '../scans/scans.module';
import { PassportsController, ProductPublishController } from './passports.controller';
import { PublicPassportController } from './public-passport.controller';
import { PassportsService } from './passports.service';
import { PassportPdfService } from './passport-pdf.service';

@Module({
  imports: [ProductsModule, QrModule, ScansModule],
  controllers: [PassportsController, ProductPublishController, PublicPassportController],
  providers: [PassportsService, PassportPdfService],
})
export class PassportsModule {}
