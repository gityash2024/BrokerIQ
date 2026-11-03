/** OS/GPS stubs exercise session fencing; this is not a handset/location accuracy test. */
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn(), Accuracy: { High: 4 } }));
import * as Location from 'expo-location';
import { AccountScopeChangedError, authStore } from '../api';
import { checkInVisit } from '../visit-check-in';

const login = (firm = 'a') => authStore.set({ accessToken: 'isolated', refreshToken: 'isolated', user: { id: 'visit-owner', role: 'BROKER_AGENT', organization: { id: firm } } } as any);
beforeEach(async () => {
  jest.clearAllMocks();
  await login();
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 28.4, longitude: 77 } });
});
afterEach(() => jest.restoreAllMocks());

it('does not read GPS after the permission dialog returns to a different firm', async () => {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockImplementationOnce(async () => { await login('b'); return { granted: true }; });
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(checkInVisit('visit-id')).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it('does not send a GPS result after an account-scope change', async () => {
  (Location.getCurrentPositionAsync as jest.Mock).mockImplementationOnce(async () => { await login('b'); return { coords: { latitude: 28.4, longitude: 77 } }; });
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(checkInVisit('visit-id')).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(send).not.toHaveBeenCalled();
});
it('denied permission performs neither a GPS read nor a mutation', async () => {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(checkInVisit('visit-id')).rejects.toThrow('Location permission');
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it('sends one owned visit check-in using the returned coordinates', async () => {
  const send = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"id":"visit-id"}' } as Response);
  await expect(checkInVisit('visit-id')).resolves.toEqual({ id: 'visit-id' });
  expect(send).toHaveBeenCalledTimes(1);
  expect(String(send.mock.calls[0][0])).toMatch(/\/visits\/visit-id$/);
  expect(JSON.parse(send.mock.calls[0][1]!.body as string)).toEqual({ checkInLat: 28.4, checkInLng: 77 });
});
