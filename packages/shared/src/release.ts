import { z } from 'zod';
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const timestamp = z.string().datetime();
const identity = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), commit, builtAt: timestamp, publishedAt: timestamp });
export const releaseManifestSchema = z.object({
  schemaVersion: z.literal(1),
  environment: z.enum(['staging', 'production']),
  portals: identity,
  android: identity.extend({
    versionCode: z.number().int().positive(),
    url: z.string().regex(/^\/downloads\/[A-Za-z0-9._-]+\.apk$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive(),
    certificateSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  screenshots: z
    .array(
      z.object({
        src: z.string().regex(/^\/product\/[A-Za-z0-9._-]+\.(?:png|webp|jpg)$/),
        description: z.string().max(300),
        versionCode: z.number().int().positive(),
        commit: commit.nullable(),
        capturedAt: timestamp,
      }),
    )
    .max(12),
});
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
