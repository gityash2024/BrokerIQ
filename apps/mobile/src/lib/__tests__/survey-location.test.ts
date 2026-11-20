jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn(), Accuracy: { High: 4 } }));

import * as Location from 'expo-location';
import { AccountScopeChangedError, authStore } from '../api';
import { readSurveyLocation } from '../survey-location';

const login = (org = 'first-firm') =>
  authStore.set({ accessToken: 'isolated', refreshToken: 'isolated', user: { id: 'owner', role: 'BROKER_AGENT', organization: { id: org } } } as any);

beforeEach(async () => {
  jest.clearAllMocks();
  await login();
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 28.45, longitude: 77.07, accuracy: 12.3 } });
});
afterEach(() => jest.restoreAllMocks());

it('returns a property link in memory without sending a location update', async () => {
  const send = jest.spyOn(globalThis, 'fetch');
  await expect(readSurveyLocation()).resolves.toEqual({ link: 'https://www.google.com/maps/dir/?api=1&destination=28.45%2C77.07', accuracy: 13 });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false, timeInterval: 0 });
  expect(send).not.toHaveBeenCalled();
});

it('skips the GPS read when permission is denied', async () => {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  await expect(readSurveyLocation()).rejects.toThrow('Allow location access');
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it('does not pass a fix from the old firm into a new account', async () => {
  (Location.getCurrentPositionAsync as jest.Mock).mockImplementationOnce(async () => {
    await login('second-firm');
    return { coords: { latitude: 28.45, longitude: 77.07, accuracy: 10 } };
  });
  await expect(readSurveyLocation()).rejects.toBeInstanceOf(AccountScopeChangedError);
});
