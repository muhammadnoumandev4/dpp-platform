import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsController } from './uploads.controller';
import { MediaController } from './media.controller';
import { UploadsService } from './uploads.service';
import { OBJECT_STORAGE } from './storage/object-storage.interface';
import { LocalDiskStorageService } from './storage/local-disk-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController, MediaController],
  providers: [UploadsService, { provide: OBJECT_STORAGE, useClass: LocalDiskStorageService }],
  // Exporting the token (not just UploadsService) is what makes QrService's
  // use of the same storage backend a real dependency, not a duplicate
  // implementation — swap the binding here and both follow.
  exports: [UploadsService, OBJECT_STORAGE],
})
export class UploadsModule {}
