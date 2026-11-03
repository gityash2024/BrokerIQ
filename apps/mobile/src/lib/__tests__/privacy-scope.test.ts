/** Native permission/read boundaries are stubbed. These tests do not inspect a real phonebook or GPS. */
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('expo-contacts', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
  Fields: { Name: 'name', PhoneNumbers: 'phoneNumbers', Emails: 'emails' },
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => Array.from(value, (char) => char.charCodeAt(0).toString(16)).join('')),
}));

import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AccountScopeChangedError, authStore } from '../api';
import { captureLocation, markAsked, setConsent, syncContacts } from '../privacy';

const login = (firm = 'a') =>
  authStore.set({
    accessToken: 'isolated',
    refreshToken: 'isolated',
    user: { id: 'privacy-owner', role: 'BROKER_AGENT', organization: { id: firm } },
  } as any);
const contactPage = {
  data: [{ name: 'Isolated contact', phoneNumbers: [{ number: '+919700000301' }], emails: [] }],
  hasNextPage: false,
};

beforeEach(async () => {
  jest.clearAllMocks();
  await login();
  (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Contacts.getContactsAsync as jest.Mock).mockResolvedValue(contactPage);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 28.4, longitude: 77.0, accuracy: 10 } });
});
afterEach(() => jest.restoreAllMocks());

it('does not upload contacts read after a firm switch', async () => {
  (Contacts.getContactsAsync as jest.Mock).mockImplementationOnce(async () => {
    await login('b');
    return contactPage;
  });
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(syncContacts()).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(send).not.toHaveBeenCalled();
});

it('stops pagination when the account changes after an acknowledged batch', async () => {
  (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({ ...contactPage, hasNextPage: true });
  const send = jest.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
    await login('b');
    return { ok: true, status: 200, text: async () => '{}' } as Response;
  });
  await expect(syncContacts()).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(send).toHaveBeenCalledTimes(1);
  expect(Contacts.getContactsAsync).toHaveBeenCalledTimes(1);
});

it('does not upload a GPS result after the user changes account scope', async () => {
  (Location.getCurrentPositionAsync as jest.Mock).mockImplementationOnce(async () => {
    await login('b');
    return { coords: { latitude: 28.4, longitude: 77.0, accuracy: 10 } };
  });
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(captureLocation()).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(send).not.toHaveBeenCalled();
});

it('binds consent to the account that opened the OS permission dialog', async () => {
  (Contacts.requestPermissionsAsync as jest.Mock).mockImplementationOnce(async () => {
    await login('b');
    return { granted: true };
  });
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(setConsent('CONTACTS', true)).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(send).not.toHaveBeenCalled();
  expect(Contacts.getContactsAsync).not.toHaveBeenCalled();
});

it('stores independent disclosure decisions per workspace without deleting legacy decisions', async () => {
  const save = jest.spyOn(SecureStore, 'setItemAsync');
  const remove = jest.spyOn(SecureStore, 'deleteItemAsync');
  await markAsked();
  const original = save.mock.calls.at(-1)![0];
  await login('b');
  await markAsked();
  const changed = save.mock.calls.at(-1)![0];
  expect(original).not.toBe(changed);
  expect(original).toMatch(/^biq\.privacy\.asked\./);
  expect(changed).toMatch(/^biq\.privacy\.asked\./);
  expect(remove).not.toHaveBeenCalled();
});
