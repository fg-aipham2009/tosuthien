import { Module } from '@nestjs/common';

import { MediaService } from './media.service';

import {

  MediaCategoriesController,

  Mp3Controller,

  YoutubeController,

} from './media.controller';

import { PublicUrlService } from '../common/public-url.service';



@Module({

  controllers: [MediaCategoriesController, Mp3Controller, YoutubeController],

  providers: [MediaService, PublicUrlService],

  exports: [MediaService],

})

export class MediaModule {}

