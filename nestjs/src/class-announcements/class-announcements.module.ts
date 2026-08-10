import { Module } from '@nestjs/common';
import { ClassAnnouncementsController } from './class-announcements.controller';
import { ClassAnnouncementsService } from './class-announcements.service';

@Module({
  controllers: [ClassAnnouncementsController],
  providers: [ClassAnnouncementsService],
  exports: [ClassAnnouncementsService],
})
export class ClassAnnouncementsModule {}
