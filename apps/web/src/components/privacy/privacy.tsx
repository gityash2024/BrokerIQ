'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Contact, Lock, MapPin, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { DATA_CONSENT_TEXT as T, PRIVACY_POLICY_VERSION, plural } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '../ui/button';
import { Switch } from '../ui/misc';
import { Dialog } from '../ui/dialog';

/**
 * Consent-based location sharing on the web (browsers can't read contacts — that is
 * app-only). Data is visible to BrokerIQ admin only; turning it off deletes it.
 */
interface Status {
  location: { granted: boolean; current: boolean } | null;
  contacts: { granted: boolean; current: boolean } | null;
  contactsCount: number;
}
const DISMISS = `biq.privacy.asked.${PRIVACY_POLICY_VERSION}`;
const LOC_AT = 'biq.privacy.loc-at';

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

function position(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }));
}
async function sendLocation() {
  const p = await position();
  await api('/me/location', { method: 'POST', body: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, platform: 'web' } });
  safeSet(LOC_AT, String(Date.now()));
}

function usePrivacy() {
  const { user } = useAuth();
  const enabled = !!user && user.role !== 'SUPER_ADMIN';
  return { enabled, q: useQuery({ queryKey: ['privacy'], queryFn: () => api<Status>('/me/privacy'), enabled, staleTime: 60_000 }) };
}

/** One-time opt-in card + daily refresh of the (already allowed) location. */
export function PrivacyConsentCard() {
  const { enabled, q } = usePrivacy();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const s = q.data;
    if (!enabled || !s) return;
    if (!s.location?.current && !safeGet(DISMISS)) setOpen(true);
    if (s.location?.granted && Date.now() - Number(safeGet(LOC_AT) ?? 0) > 86_400_000 && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((p) => (p.state === 'granted' ? sendLocation() : undefined))
        .catch(() => undefined);
    }
  }, [enabled, q.data]);
  const dismiss = () => {
    safeSet(DISMISS, '1');
    setOpen(false);
  };
  const allow = async () => {
    setBusy(true);
    try {
      await position(); // browser permission first — consent is recorded only if the user actually allows it
      await api('/me/consent', { method: 'POST', body: { kind: 'LOCATION', granted: true, platform: 'web' } });
      await sendLocation();
      qc.invalidateQueries({ queryKey: ['privacy'] });
      toast.success('धन्यवाद 🙏 — Privacy settings से कभी भी बंद कर सकते हैं');
      dismiss();
    } catch (e) {
      toast.error(e instanceof GeolocationPositionError ? 'Browser में location permission नहीं मिली' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()} title={T.title} description={T.intro}>
      <div className="space-y-3 text-sm">
        <div className="flex gap-3 rounded-xl border border-line p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <MapPin className="size-5" />
          </span>
          <div>
            <p className="font-semibold">{T.location.title}</p>
            <p className="text-muted">
              <b className="text-fg">क्या:</b> {T.location.what} <b className="text-fg">क्यों:</b> {T.location.why}
            </p>
          </div>
        </div>
        <p className="flex gap-1.5 text-xs text-muted">
          <Smartphone className="mt-0.5 size-3.5 shrink-0" /> Contacts sharing सिर्फ़ BrokerIQ mobile app में (आपकी अलग अनुमति से) होती है।
        </p>
        <p className="flex gap-1.5 text-xs text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> {T.who}
        </p>
        <p className="flex gap-1.5 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> {T.security}
        </p>
        <p className="text-xs text-subtle">{T.optional}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={allow} loading={busy}>
          <MapPin className="size-4" /> Location Allow करें
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          {T.notNow}
        </Button>
        <a href="/p/privacy" target="_blank" className="ml-auto self-center text-xs font-semibold text-brand-600 hover:underline">
          Privacy policy →
        </a>
      </div>
    </Dialog>
  );
}

/** Settings page body (account + broker panels). */
export function PrivacySettings() {
  const { q } = usePrivacy();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const s = q.data;
  const setLocation = async (on: boolean) => {
    if (!on && !confirm('Location sharing बंद करें? BrokerIQ के पास मौजूद आपकी location history delete हो जाएगी।')) return;
    setBusy(true);
    try {
      if (on) await position();
      await api('/me/consent', { method: 'POST', body: { kind: 'LOCATION', granted: on, platform: 'web' } });
      if (on) await sendLocation();
      qc.invalidateQueries({ queryKey: ['privacy'] });
      toast.success(on ? 'Location sharing चालू' : 'बंद हो गया — location data delete कर दिया गया');
    } catch (e) {
      toast.error(e instanceof GeolocationPositionError ? 'Browser में location permission नहीं मिली' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const stopContacts = async () => {
    if (!confirm('Contacts sharing बंद करें? BrokerIQ के पास मौजूद आपके सारे contacts delete हो जाएँगे।')) return;
    setBusy(true);
    try {
      await api('/me/data/CONTACTS', { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['privacy'] });
      toast.success('Contacts sharing बंद — data delete कर दिया गया');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-2xl space-y-4">
      <div className="card flex items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <MapPin className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold">{T.location.title}</p>
          <p className="text-sm text-muted">
            {T.location.what} {T.location.why}
          </p>
        </div>
        <Switch checked={!!s?.location?.granted} disabled={busy || !s} onCheckedChange={setLocation} />
      </div>
      <div className="card flex items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <Contact className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold">{T.contacts.title}</p>
          <p className="text-sm text-muted">
            {T.contacts.what} {T.contacts.why}
          </p>
          {s?.contacts?.granted ? (
            <p className="mt-2 text-xs text-muted">{plural(s.contactsCount, 'contact')} shared (mobile app से)</p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <Smartphone className="size-3.5" /> Browser contacts नहीं पढ़ सकता — यह BrokerIQ mobile app में Profile → Privacy से चालू होता है।
            </p>
          )}
        </div>
        {s?.contacts?.granted && (
          <Button size="sm" variant="secondary" loading={busy} onClick={stopContacts}>
            बंद करें
          </Button>
        )}
      </div>
      <div className="card space-y-2 bg-surface-2 p-5 text-sm">
        <p className="flex gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {T.who}
        </p>
        <p className="text-muted">{T.security}</p>
      </div>
    </div>
  );
}
