import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { env } from './config/env';

/** Shared app configuration for main.ts and e2e tests. */
export function configureApp(app: INestApplication) {
  const e = env();
  const exp = app as NestExpressApplication;
  exp.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  // Production and integration tests must exercise the same request boundary,
  // including base64 chunk uploads and exact bytes for signed webhooks.
  app.use(json({ limit: '20mb', verify: (req: any, _res, buf) => (req.rawBody = buf) }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  const origins = e.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });
  app.enableShutdownHooks();
  return app;
}
