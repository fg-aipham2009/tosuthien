import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { PdfModule } from './pdf/pdf.module';
import { CentersModule } from './centers/centers.module';
import { CoursesModule } from './courses/courses.module';
import { MediaModule } from './media/media.module';
import { RagModule } from './rag/rag.module';
import { UploadModule } from './upload/upload.module';
import { FilesModule } from './files/files.module';
import { TextBooksModule } from './text-books/text-books.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.join(__dirname, '../../.env'), '.env'],
    }),
    PrismaModule,
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const root = path.resolve(
          config.get<string>('DATA_ROOT') || path.join(process.cwd(), '..', 'data'),
        );
        return [{
          rootPath: root,
          serveRoot: '/files',
          serveStaticOptions: { index: false, fallthrough: true },
        }];
      },
    }),
    PdfModule,
    CentersModule,
    CoursesModule,
    MediaModule,
    RagModule,
    UploadModule,
    FilesModule,
    TextBooksModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
