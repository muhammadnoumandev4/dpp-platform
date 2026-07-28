import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { QrService } from './qr.service';

@Module({
  imports: [UploadsModule],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
