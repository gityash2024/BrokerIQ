import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { env } from './config/env';

async function bootstrap() {
  const e = env();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false });
  configureApp(app);

  // The full API map is not published in production (enable with SWAGGER_ENABLED=true when needed).
  if (e.SWAGGER_ENABLED === 'true' || (e.NODE_ENV !== 'production' && e.SWAGGER_ENABLED !== 'false')) {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('BrokerIQ API').setVersion('2.0').addBearerAuth().build());
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(e.PORT, e.HOST);
  Logger.log(`BrokerIQ API listening on :${e.PORT} (${e.NODE_ENV})`, 'Bootstrap');
}
bootstrap();
