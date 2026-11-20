import * as Location from 'expo-location';
import { surveyLocationLink } from '@brokeriq/shared';
import { assertAccountContext, captureAccountContext } from './api';

export async function readSurveyLocation(owner = captureAccountContext()) {
  assertAccountContext(owner);
  if (!owner.userId) throw new Error('Sign in before capturing a property location.');
  const permission = await Location.requestForegroundPermissionsAsync();
  assertAccountContext(owner);
  if (!permission.granted) throw new Error('Allow location access or enter the property map link.');

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Could not get a location fix. Try again or enter the property map link.')), 15_000);
    });
    const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), deadline]);
    assertAccountContext(owner);
    return { link: surveyLocationLink(position.coords), accuracy: Math.ceil(position.coords.accuracy ?? 0) };
  } finally {
    clearTimeout(timer);
  }
}
