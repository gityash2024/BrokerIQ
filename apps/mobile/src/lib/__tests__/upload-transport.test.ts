import { authStore, uploadUri, requestActivity, AccountScopeChangedError } from '../api';
import { File } from 'expo-file-system';
// Exercise the installed SDK encoder, including its explicit rejection of legacy URI parts.
const { convertFormDataAsync } = require('expo/src/winter/fetch/convertFormData');
const { installFormDataPatch } = jest.requireActual('expo/src/winter/FormData');
const rnFormDataModule = jest.requireActual('react-native/Libraries/Network/FormData');
const RNFormData = rnFormDataModule.default ?? rnFormDataModule;
const originalFormData = globalThis.FormData;
beforeAll(() => {
  installFormDataPatch(RNFormData);
  globalThis.FormData = RNFormData;
});
afterAll(() => {
  globalThis.FormData = originalFormData;
});
const payload = new Uint8Array([0x49, 0x49, 0x2a, 0, 0xff, 0x00]);
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
const session = (id: string) => ({ accessToken: 'test-token', refreshToken: 'test-refresh', user: { id, role: 'BROKER_AGENT' } }) as any;
const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, text: async () => JSON.stringify(body), json: async () => body }) as Response;
beforeEach(async () => {
  await authStore.set(session('upload-owner'));
  (File as unknown as jest.Mock).mockImplementation(() => ({
    name: 'selected.bin',
    type: 'application/octet-stream',
    size: payload.length,
    bytes: async () => payload,
  }));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await authStore.set(null);
});
it.each(['image/jpeg', 'video/mp4', 'application/pdf'])('uses bytes that the installed Expo multipart encoder accepts for %s', async (mime) => {
  const send = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response({ provider: 'cloudinary', fields: { folder: 'private-test' }, uploadUrl: 'https://upload.example.test' }));
  send.mockImplementationOnce(async (_url, options) => {
    const body = options!.body as FormData;
    const result = await convertFormDataAsync(body);
    expect(result.body.length).toBeGreaterThan(payload.length);
    return response({ secure_url: 'https://files.example.test/result', public_id: 'result' });
  });
  await expect(uploadUri('file:///isolated.bin', 'listing', mime)).resolves.toEqual({ url: 'https://files.example.test/result', publicId: 'result' });
  expect(send).toHaveBeenCalledTimes(2);
  expect(requestActivity.getSnapshot()).toBe(0);
});
it('uploads raw bytes for private KYC/local/S3 PUT rather than fetching a file URI', async () => {
  const send = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      response({
        provider: 'local',
        uploadUrl: 'https://private.example.test/upload',
        publicUrl: 'https://private.example.test/file',
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )
    .mockResolvedValueOnce(response({}));
  await expect(uploadUri('file:///kyc.pdf', 'kyc', 'application/pdf')).resolves.toEqual({ url: 'https://private.example.test/file' });
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][1]?.method).toBe('PUT');
  expect(send.mock.calls[1][1]?.body).toEqual(payload);
});
it('rejects empty files without sending provider requests', async () => {
  (File as unknown as jest.Mock).mockImplementation(() => ({ size: 0, bytes: async () => new Uint8Array() }));
  const send = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ provider: 'cloudinary' }));
  await expect(uploadUri('file:///empty.jpg', 'listing')).rejects.toThrow('empty');
  expect(send).toHaveBeenCalledTimes(1);
});
it('retains the account fence while file bytes are being read', async () => {
  (File as unknown as jest.Mock).mockImplementation(() => ({
    size: payload.length,
    bytes: async () => {
      await authStore.set(session('new-owner'));
      return payload;
    },
  }));
  const send = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ provider: 'local' }));
  await expect(uploadUri('file:///selected.jpg', 'kyc')).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(send).toHaveBeenCalledTimes(1);
});
