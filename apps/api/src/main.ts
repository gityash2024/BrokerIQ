import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { env } from './config/env';

async function bootstrap() {
  const e = env();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bodyParser: false });
  app.use(json({ limit: '12mb', verify: (req: any, _res, buf) => (req.rawBody = buf) }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  configureApp(app);

  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('BrokerIQ API').setVersion('2.0').addBearerAuth().build());
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(e.PORT, '0.0.0.0');
  Logger.log(`BrokerIQ API listening on :${e.PORT} (${e.NODE_ENV})`, 'Bootstrap');
}
bootstrap();
