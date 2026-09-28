import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { AiController } from './ai.controller';
@Module({ imports: [ListingsModule], controllers: [AiController] })
export class AiModule {}
