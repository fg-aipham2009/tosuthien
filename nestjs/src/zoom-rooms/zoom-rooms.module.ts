import { Module } from '@nestjs/common';
import { ZoomRoomsController } from './zoom-rooms.controller';
import { ZoomRoomsService } from './zoom-rooms.service';

@Module({
  controllers: [ZoomRoomsController],
  providers: [ZoomRoomsService],
  exports: [ZoomRoomsService],
})
export class ZoomRoomsModule {}
