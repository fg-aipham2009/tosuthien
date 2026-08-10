import { Module } from '@nestjs/common';
import { DharmaClassesController } from './dharma-classes.controller';
import { DharmaClassesService } from './dharma-classes.service';

@Module({
  controllers: [DharmaClassesController],
  providers: [DharmaClassesService],
  exports: [DharmaClassesService],
})
export class DharmaClassesModule {}
