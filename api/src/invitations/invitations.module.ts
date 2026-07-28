import { Module } from '@nestjs/common';
import { InvitationsController, PublicInvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
