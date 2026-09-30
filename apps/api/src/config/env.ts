import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';
const devDefault = <T extends z.ZodTypeAny>(schema: T, value: string) => (isProd ? schema : schema.default(value as never));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Interactive API docs at /api/docs — off in production unless explicitly enabled. */
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  /** Server watchdog writes auto-restarts here; the API reports them to Super Admins. */
  WATCHDOG_INCIDENTS_FILE: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  /** Bind address; self-hosted deployments behind nginx use 127.0.0.1. */
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: devDefault(z.string().min(32), 'dev_access_secret_change_me_0123456789abcdef'),
  JWT_REFRESH_SECRET: devDefault(z.string().min(32), 'dev_refresh_secret_change_me_0123456789abcdef'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  ENCRYPTION_MASTER_KEY: devDefault(
    z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_MASTER_KEY must be 64 hex chars (openssl rand -hex 32)'),
    '0000000000000000000000000000000000000000000000000000000000000000',
  ),
  CORS_ORIGINS: z.string().default('*'),
  PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3001'),
  /** Self-hosted media: when set, uploads are compressed + encrypted onto this directory (takes precedence over Cloudinary/S3). */
  MEDIA_ROOT: z.string().optional(),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  SUPER_ADMIN_NAME: z.string().default('Super Admin'),
  JOBS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
