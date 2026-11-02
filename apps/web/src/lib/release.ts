import 'server-only';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { releaseManifestSchema, type ReleaseManifest } from '@brokeriq/shared';

/** Candidate-local manifest is generated only from actual build/download artifacts. Never infer an APK release from a web date. */
export async function getRelease(): Promise<ReleaseManifest | null> {
  try {
    return releaseManifestSchema.parse(
      JSON.parse(await readFile(process.env.BROKERIQ_RELEASE_MANIFEST || resolve(process.cwd(), '../../release-manifest.json'), 'utf8')),
    );
  } catch {
    if (process.env.NODE_ENV === 'production') throw new Error('Verified release manifest missing or invalid');
    return null;
  }
}
