import { normalizeNativeIntent } from '@brokeriq/shared';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return normalizeNativeIntent(path);
}
