import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';

/** Shared app configuration for main.ts and e2e tests. */
export function configureApp(app: INestApplication) {
  const e = env();
  const exp = app as NestExpressApplication;
  exp.set('trust proxy', 1);
  app.setGlobalPrefix('api');
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
