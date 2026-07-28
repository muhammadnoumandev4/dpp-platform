import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ScansModule } from '../scans/scans.module';

@Module({
  imports: [ScansModule],
  controllers: [HealthController],
})
export class HealthModule {}
