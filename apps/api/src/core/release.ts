import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Compiled candidate-local identity, not an editable SystemSetting or a server-supplied runtime date. */
export function compiledRelease(): { commit: string; version: string; builtAt: string } | null {
  try {
    const data = JSON.parse(readFileSync(resolve(__dirname, '../../release.json'), 'utf8'));
    if (!/^[a-f0-9]{40}$/.test(data.commit) || !/^\d+\.\d+\.\d+$/.test(data.version) || !Number.isFinite(Date.parse(data.builtAt))) return null;
    return { commit: data.commit, version: data.version, builtAt: data.builtAt };
  } catch {
    return null;
  }
}
