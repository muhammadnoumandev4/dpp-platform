import { Module } from '@nestjs/common';
import { ScansService } from './scans.service';
import { ScanQueueService } from './scan-queue.service';

@Module({
  providers: [ScansService, ScanQueueService],
  exports: [ScansService, ScanQueueService],
})
export class ScansModule {}
