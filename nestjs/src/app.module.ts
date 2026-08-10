import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { PdfModule } from './pdf/pdf.module';
import { CentersModule } from './centers/centers.module';
import { CoursesModule } from './courses/courses.module';
import { MediaModule } from './media/media.module';
import { PostsModule } from './posts/posts.module';
import { RagModule } from './rag/rag.module';
import { UploadModule } from './upload/upload.module';
import { FilesModule } from './files/files.module';
import { TextBooksModule } from './text-books/text-books.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { TeachersModule } from './teachers/teachers.module';
import { DharmaClassesModule } from './dharma-classes/dharma-classes.module';
import { ClassAnnouncementsModule } from './class-announcements/class-announcements.module';
import { ZoomRoomsModule } from './zoom-rooms/zoom-rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Production (Docker): use container env only — never a stale mounted/baked .env.
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: [path.join(__dirname, '../../.env'), '.env'],
    }),
    PrismaModule,
    AuthModule,
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
    PostsModule,
    RagModule,
    UploadModule,
    FilesModule,
    TextBooksModule,
    TeachersModule,
    DharmaClassesModule,
    ClassAnnouncementsModule,
    ZoomRoomsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
