import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { authStore, registerSessionReset, uploadUri } from './api';
import { tr } from './i18n';

type CaptureResult = { owner: string; canceled: boolean; paths: string[]; error?: string; engine: string };
interface FaceBridge {
  capture(owner: string, labels: Record<string, string>, dark: boolean): Promise<CaptureResult>;
  pending(owner: string): Promise<CaptureResult | null>;
  cancel(): Promise<void>;
  discard(paths: string[]): Promise<void>;
}
const bridge = requireOptionalNativeModule<FaceBridge>('BrokerIQFaceCapture');
const pending = new Map<string, { scope: string; paths: string[]; urls: (string | null)[] }>();
let running = false;
const scope = () => {
  const user = authStore.get()?.user;
  return user ? `${user.id}:${user.role}:${user.organization?.id ?? ''}` : '';
};
registerSessionReset(async () => {
  const files = [...pending.values()].flatMap((entry) => entry.paths);
  pending.clear();
  await bridge?.cancel().catch(() => undefined);
  if (files.length) await bridge?.discard(files).catch(() => undefined);
});

export function hasPendingFaceCaptures(owner: string) {
  return pending.has(owner);
}
export async function discardFaceCaptures(owner: string) {
  const entry = pending.get(owner);
  pending.delete(owner);
  if (entry) await bridge?.discard(entry.paths).catch(() => undefined);
}
const labels = () =>
  Object.fromEntries(
    Object.entries({
      title: 'Face captures',
      reviewer: 'Your reviewer decides KYC approval. These checks guide photo capture.',
      STRAIGHT: 'Look straight',
      LEFT: 'Turn left',
      RIGHT: 'Turn right',
      cancel: 'Cancel',
      review: 'Check the complete face before accepting.',
      retake: 'Retake',
      accept: 'Accept capture',
      finish: 'Use all three captures',
      starting: 'Starting camera…',
      capture: 'Capture',
      oneFace: 'Only one face should be visible',
      center: 'Place your complete face in the camera',
      blink: 'Look straight and blink once',
      ready: 'Ready — capture now',
      hold: 'Hold still',
      detectionFailed: 'Face detection failed. Retry or cancel.',
      captureFailed: 'Capture failed. Please retry.',
      moved: 'Face moved during capture. Please retry.',
    }).map(([key, value]) => [key, tr(value)]),
  );

export async function captureGuidedFaces(owner: string, dark: boolean): Promise<{ straightUrl: string; leftUrl: string; rightUrl: string } | null> {
  if (running) throw new Error('Face capture is already in progress.');
  running = true;
  try {
    if (Platform.OS !== 'android' || !bridge) throw new Error('Guided face capture needs the updated BrokerIQ Android app.');
    const originalScope = scope();
    const assertOwner = () => {
      if (!originalScope || scope() !== originalScope || authStore.get()?.user.id !== owner) throw new Error('Account permissions changed. Reopen KYC.');
    };
    assertOwner();
    const captureOwner = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, originalScope);
    assertOwner();
    let entry = pending.get(owner);
    if (entry && entry.scope !== originalScope) {
      await discardFaceCaptures(owner);
      entry = undefined;
    }
    if (!entry) {
      const restored = await bridge.pending(captureOwner);
      const result = restored && !restored.canceled ? restored : await bridge.capture(captureOwner, labels(), dark);
      if (scope() !== originalScope) {
        await bridge.discard(result.paths).catch(() => undefined);
        assertOwner();
      }
      if (result.error)
        throw new Error(
          result.error === 'CAMERA_PERMISSION_REQUIRED' ? 'Camera permission is required.' : 'Face capture could not start. Please retry or update the app.',
        );
      if (result.canceled) return null;
      if (
        result.owner !== captureOwner ||
        result.paths.length !== 3 ||
        new Set(result.paths).size !== 3 ||
        !result.paths.every((p, index) => p.startsWith('file://') && p.endsWith(`_${['STRAIGHT', 'LEFT', 'RIGHT'][index]}.jpg`))
      ) {
        await bridge.discard(result.paths).catch(() => undefined);
        throw new Error('Invalid face capture result. Please retry.');
      }
      entry = { scope: originalScope, paths: result.paths, urls: [null, null, null] };
      pending.set(owner, entry);
    }
    for (let index = 0; index < 3; index++) {
      assertOwner();
      if (!entry.urls[index]) entry.urls[index] = (await uploadUri(entry.paths[index], 'kyc')).url;
      assertOwner();
    }
    const [straightUrl, leftUrl, rightUrl] = entry.urls as [string, string, string];
    await discardFaceCaptures(owner);
    assertOwner();
    return { straightUrl, leftUrl, rightUrl };
  } finally {
    running = false;
  }
}
