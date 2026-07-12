import { Module } from '@nestjs/common';
import { TextBooksController } from './text-books.controller';
import { TextBooksService } from './text-books.service';

@Module({
  controllers: [TextBooksController],
  providers: [TextBooksService],
  exports: [TextBooksService],
})
export class TextBooksModule {}
