import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PRIVACY_POLICY_VERSION, type ConsentKind } from '@brokeriq/shared';
import { api, accountScope, assertAccountContext, captureAccountContext, type AccountContext } from './api';
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

function assertOwner(owner: AccountContext) {
  assertAccountContext(owner);
  if (!owner.userId) throw new Error('Sign in before sharing private device data.');
}

async function privacyKey(owner: AccountContext, key: string) {
  assertOwner(owner);
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner.scope);
  assertOwner(owner);
  return `${key}.${digest}`;
}

export async function captureLocation(owner = captureAccountContext()) {
  assertOwner(owner);
  const perm = await Location.getForegroundPermissionsAsync();
  assertOwner(owner);
  if (!perm.granted) return false;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  assertOwner(owner);
  await api('/me/location', {
    body: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, platform },
    ownerContext: owner,
  });
  await SecureStore.setItemAsync(await privacyKey(owner, LOC_AT), String(Date.now()));
  assertOwner(owner);
  return true;
}

/** Reads the phonebook page by page and uploads it in batches (server dedupes and encrypts). */
export async function syncContacts(onProgress?: (done: number) => void, owner = captureAccountContext()) {
  assertOwner(owner);
  const perm = await Contacts.getPermissionsAsync();
  assertOwner(owner);
  if (!perm.granted) return 0;
  let offset = 0;
  let sent = 0;
  for (;;) {
    assertOwner(owner);
    const page = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      pageSize: 500,
      pageOffset: offset,
    });
    assertOwner(owner);
    const batch = page.data
      .map((c) => ({
        name: c.name ?? null,
        phones: (c.phoneNumbers ?? [])
          .map((p) => p.number ?? '')
          .filter(Boolean)
          .slice(0, 10),
        emails: (c.emails ?? [])
          .map((e) => e.email ?? '')
          .filter(Boolean)
          .slice(0, 5),
      }))
      .filter((c) => c.phones.length);
    if (batch.length) await api('/me/contacts/sync', { body: { contacts: batch }, ownerContext: owner });
    assertOwner(owner);
    sent += batch.length;
    onProgress?.(sent);
    if (!page.hasNextPage) break;
    offset += 500;
  }
  await SecureStore.setItemAsync(await privacyKey(owner, CONTACTS_AT), String(Date.now()));
  assertOwner(owner);
  return sent;
}

/** Records the user's choice; OS permission is requested only for what they opted into. */
export async function setConsent(kind: ConsentKind, granted: boolean, owner = captureAccountContext()) {
  assertOwner(owner);
  if (granted) {
    const perm = kind === 'LOCATION' ? await Location.requestForegroundPermissionsAsync() : await Contacts.requestPermissionsAsync();
    assertOwner(owner);
    if (!perm.granted) return false;
  }
  await api('/me/consent', { body: { kind, granted, platform }, ownerContext: owner });
  if (granted) {
    if (kind === 'LOCATION') await captureLocation(owner).catch(() => undefined);
    else await syncContacts(undefined, owner).catch(() => undefined);
  }
  assertOwner(owner);
  return true;
}

export async function markAsked(owner = captureAccountContext()) {
  await SecureStore.setItemAsync(await privacyKey(owner, ASKED_KEY), '1');
  assertOwner(owner);
}

const olderThan = async (owner: AccountContext, key: string, ms: number) => {
  const saved = await SecureStore.getItemAsync(await privacyKey(owner, key));
  assertOwner(owner);
  return Date.now() - Number(saved ?? 0) > ms;
};

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
    const owner = captureAccountContext();
    if (owner.scope !== accountScope(user)) return;
    (async () => {
      const decided = s.location?.current || s.contacts?.current;
      if (!decided && !(await SecureStore.getItemAsync(await privacyKey(owner, ASKED_KEY)))) {
        assertOwner(owner);
        router.push('/data-consent');
        return;
      }
      if (s.location?.granted && (await olderThan(owner, LOC_AT, DAY))) await captureLocation(owner).catch(() => undefined);
      if (s.contacts?.granted && (await olderThan(owner, CONTACTS_AT, 7 * DAY))) {
        await syncContacts(undefined, owner).catch(() => undefined);
        assertOwner(owner);
        qc.invalidateQueries({ queryKey: ['privacy'] });
      }
    })().catch(() => undefined);
  }, [enabled, status.data, qc, user]);
}
