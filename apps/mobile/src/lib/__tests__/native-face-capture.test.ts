/** Orchestration tests at the native bridge/upload boundary, not physical face-detector acceptance. */
jest.mock('expo', () => {
  const native = { capture: jest.fn(), pending: jest.fn(), cancel: jest.fn(), discard: jest.fn() };
  return { requireOptionalNativeModule: () => native };
});
jest.mock('../api', () => ({ authStore: { get: jest.fn() }, uploadUri: jest.fn(), registerSessionReset: jest.fn() }));
jest.mock('../i18n', () => ({ tr: (value: string) => value }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_algorithm: string, scope: string) => `hash_${scope.replace(/:/g, '_')}`),
}));
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { authStore, uploadUri, registerSessionReset } from '../api';
import { captureGuidedFaces, discardFaceCaptures, hasPendingFaceCaptures } from '../native-face-capture';
// The module instance is stable, just as Expo's native module registry is stable.
const bridge = requireOptionalNativeModule<any>('BrokerIQFaceCapture')!;

const resetSession = (registerSessionReset as jest.Mock).mock.calls[0][0] as () => Promise<void>;
const user = { id: 'capture-user', role: 'BROKER_AGENT', organization: { id: 'firm-a' } };
const paths = ['STRAIGHT', 'LEFT', 'RIGHT'].map((pose) => `file:///private/cache/id_${pose}.jpg`);
const result = () => ({ owner: 'hash_capture-user_BROKER_AGENT_firm-a', canceled: false, paths, engine: 'test-boundary' });
beforeEach(async () => {
  await discardFaceCaptures(user.id);
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  (authStore.get as jest.Mock).mockReturnValue({ user });
  bridge.pending.mockResolvedValue(null);
  bridge.capture.mockResolvedValue(result());
  bridge.discard.mockResolvedValue(undefined);
  bridge.cancel.mockResolvedValue(undefined);
  (uploadUri as jest.Mock).mockImplementation(async (path: string) => ({ url: `/api/media/kyc/${path.split('_').pop()}` }));
});
it('uploads three ordered captures and deletes private local files after success', async () => {
  const urls = await captureGuidedFaces(user.id, true);
  expect(urls).toEqual({ straightUrl: '/api/media/kyc/STRAIGHT.jpg', leftUrl: '/api/media/kyc/LEFT.jpg', rightUrl: '/api/media/kyc/RIGHT.jpg' });
  expect((uploadUri as jest.Mock).mock.calls.map((call) => call[0])).toEqual(paths);
  expect(bridge.discard).toHaveBeenCalledWith(paths);
  expect(hasPendingFaceCaptures(user.id)).toBe(false);
});
it('retries a partial upload without recapturing or uploading successful poses twice', async () => {
  (uploadUri as jest.Mock).mockResolvedValueOnce({ url: 'private-straight' }).mockRejectedValueOnce(new Error('offline'));
  await expect(captureGuidedFaces(user.id, false)).rejects.toThrow('offline');
  expect(hasPendingFaceCaptures(user.id)).toBe(true);
  await expect(captureGuidedFaces(user.id, false)).resolves.toMatchObject({ straightUrl: 'private-straight' });
  expect(bridge.capture).toHaveBeenCalledTimes(1);
  expect((uploadUri as jest.Mock).mock.calls.filter((call) => call[0] === paths[0])).toHaveLength(1);
});
it.each(['role', 'firm'])('discards captures returned after a same-user %s change', async (change) => {
  bridge.capture.mockImplementationOnce(async () => {
    (authStore.get as jest.Mock).mockReturnValue({ user: { ...user, ...(change === 'role' ? { role: 'BROKER_ADMIN' } : { organization: { id: 'firm-b' } }) } });
    return result();
  });
  await expect(captureGuidedFaces(user.id, false)).rejects.toThrow('Account permissions changed');
  expect(uploadUri).not.toHaveBeenCalled();
  expect(bridge.discard).toHaveBeenCalledWith(paths);
});
it('does not continue uploading after the account changes during upload', async () => {
  (uploadUri as jest.Mock).mockImplementationOnce(async () => {
    (authStore.get as jest.Mock).mockReturnValue({ user: { ...user, id: 'other' } });
    return { url: 'private-original-user' };
  });
  await expect(captureGuidedFaces(user.id, false)).rejects.toThrow('Account permissions changed');
  expect(uploadUri).toHaveBeenCalledTimes(1);
  expect(hasPendingFaceCaptures(user.id)).toBe(true);
});
it('rejects malformed/duplicate paths and handles cancellation without upload', async () => {
  bridge.capture.mockResolvedValueOnce({ ...result(), paths: [paths[0], paths[0], paths[2]] });
  await expect(captureGuidedFaces(user.id, false)).rejects.toThrow('Invalid face capture');
  expect(bridge.discard).toHaveBeenCalled();
  expect(uploadUri).not.toHaveBeenCalled();
  bridge.capture.mockResolvedValueOnce({ ...result(), canceled: true, paths: [] });
  await expect(captureGuidedFaces(user.id, false)).resolves.toBeNull();
});
it('fails closed on unsupported platforms instead of falling back to a gallery photo', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  await expect(captureGuidedFaces(user.id, false)).rejects.toThrow('updated BrokerIQ Android app');
  expect(bridge.capture).not.toHaveBeenCalled();
  expect(uploadUri).not.toHaveBeenCalled();
});

it('clears pending files on session reset even when native cancellation is delayed', async () => {
  (uploadUri as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(captureGuidedFaces(user.id, false)).rejects.toThrow('offline');
  expect(hasPendingFaceCaptures(user.id)).toBe(true);
  let release!: () => void;
  bridge.cancel.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const reset = resetSession();
  expect(hasPendingFaceCaptures(user.id)).toBe(false);
  release();
  await reset;
  expect(bridge.discard).toHaveBeenCalledWith(paths);
});
