import * as Location from 'expo-location';
import { api, assertAccountContext, captureAccountContext } from './api';

/** The OS permission prompt and GPS read belong to the session that tapped Check in. */
export async function checkInVisit(visitId: string, owner = captureAccountContext()) {
  assertAccountContext(owner);
  if (!owner.userId || !visitId) throw new Error('Sign in and reopen this visit before checking in.');
  const permission = await Location.requestForegroundPermissionsAsync();
  assertAccountContext(owner);
  if (!permission.granted) throw new Error('Location permission दें');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  assertAccountContext(owner);
  return api(`/visits/${encodeURIComponent(visitId)}`, {
    method: 'PATCH',
    ownerContext: owner,
    body: { checkInLat: position.coords.latitude, checkInLng: position.coords.longitude },
  });
}
