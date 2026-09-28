import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PRIVACY_POLICY_VERSION, type ConsentKind } from '@brokeriq/shared';
import { api, post } from './api';
import { useAuth } from './auth';

/**
 * Consent-based location & contacts sharing. Nothing is read from the device before the
 * user opts in on the disclosure screen; the data is visible to BrokerIQ admin only.
 */
const platform = Platform.OS === 'ios' ? 'ios' : 'android';
const ASKED_KEY = `biq.privacy.asked.${PRIVACY_POLICY_VERSION}`;
const LOC_AT = 'biq.privacy.loc-at';
const CONTACTS_AT = 'biq.privacy.contacts-at';
const DAY = 86_400_000;

export interface PrivacyStatus {
  policyVersion: string;
  location: { granted: boolean; at: string; current: boolean } | null;
  contacts: { granted: boolean; at: string; current: boolean } | null;
  contactsCount: number;
  lastLocationAt: string | null;
}

export function usePrivacyStatus(enabled = true) {
  return useQuery({ queryKey: ['privacy'], queryFn: () => api<PrivacyStatus>('/me/privacy'), enabled, staleTime: 60_000 });
}

export async function captureLocation() {
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return false;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await post('/me/location', { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, platform });
  await SecureStore.setItemAsync(LOC_AT, String(Date.now()));
  return true;
}

/** Reads the phonebook page by page and uploads it in batches (server dedupes and encrypts). */
export async function syncContacts(onProgress?: (done: number) => void) {
  const perm = await Contacts.getPermissionsAsync();
  if (!perm.granted) return 0;
  let offset = 0;
  let sent = 0;
  for (;;) {
    const page = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails], pageSize: 500, pageOffset: offset });
    const batch = page.data
      .map((c) => ({ name: c.name ?? null, phones: (c.phoneNumbers ?? []).map((p) => p.number ?? '').filter(Boolean).slice(0, 10), emails: (c.emails ?? []).map((e) => e.email ?? '').filter(Boolean).slice(0, 5) }))
      .filter((c) => c.phones.length);
    if (batch.length) await post('/me/contacts/sync', { contacts: batch });
    sent += batch.length;
    onProgress?.(sent);
    if (!page.hasNextPage) break;
    offset += 500;
  }
  await SecureStore.setItemAsync(CONTACTS_AT, String(Date.now()));
  return sent;
}

/** Records the user's choice; OS permission is requested only for what they opted into. */
export async function setConsent(kind: ConsentKind, granted: boolean) {
  if (granted) {
    const perm = kind === 'LOCATION' ? await Location.requestForegroundPermissionsAsync() : await Contacts.requestPermissionsAsync();
    if (!perm.granted) return false;
  }
  await post('/me/consent', { kind, granted, platform });
  if (granted) {
    if (kind === 'LOCATION') await captureLocation().catch(() => undefined);
    else await syncContacts().catch(() => undefined);
  }
  return true;
}

export async function markAsked() {
  await SecureStore.setItemAsync(ASKED_KEY, '1');
}

const olderThan = async (key: string, ms: number) => Date.now() - Number((await SecureStore.getItemAsync(key)) ?? 0) > ms;

/**
 * Mounted once for signed-in users: shows the disclosure once per policy version and, for
 * what the user allowed, refreshes the location daily and the contacts weekly.
 */
export function usePrivacySync() {
  const { user } = useAuth();
  const enabled = !!user && user.role !== 'SUPER_ADMIN';
  const status = usePrivacyStatus(enabled);
  const qc = useQueryClient();
  useEffect(() => {
    const s = status.data;
    if (!enabled || !s) return;
    (async () => {
      const decided = s.location?.current || s.contacts?.current;
      if (!decided && !(await SecureStore.getItemAsync(ASKED_KEY))) {
        router.push('/data-consent');
        return;
      }
      if (s.location?.granted && (await olderThan(LOC_AT, DAY))) await captureLocation().catch(() => undefined);
      if (s.contacts?.granted && (await olderThan(CONTACTS_AT, 7 * DAY))) {
        await syncContacts().catch(() => undefined);
        qc.invalidateQueries({ queryKey: ['privacy'] });
      }
    })();
  }, [enabled, status.data, qc]);
}
