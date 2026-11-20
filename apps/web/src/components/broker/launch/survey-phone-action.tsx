'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeIndianPhone, normalizeInventoryDirections, surveyPhoneInputSchema } from '@brokeriq/shared';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SurveyLocationField } from './survey-location-field';

const blankContact = () => ({ name: '', phone: '', role: 'OWNER' as const });

export function SurveyPhoneAction({ allowed, sector }: { allowed: boolean; sector?: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState(() => [blankContact()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [directions, setDirections] = useState('');
  const [readingLocation, setReadingLocation] = useState(false);
  const mutationId = useRef<string | null>(null);
  const saving = useRef(false);

  async function save() {
    if (!allowed || saving.current || readingLocation) return;
    const filled = contacts.filter(({ name, phone }) => name.trim() || phone.trim());
    if (!filled.length || filled.some(({ phone }) => !normalizeIndianPhone(phone))) {
      setError('Enter a valid Indian phone number for each contact');
      return;
    }
    mutationId.current ??= crypto.randomUUID();
    const parsed = surveyPhoneInputSchema.safeParse({
      contacts: filled,
      sector,
      directionsUrl: normalizeInventoryDirections(directions) ?? undefined,
      clientMutationId: mutationId.current,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await api('/inventory/survey-phone', { method: 'POST', body: parsed.data, ownerContext: captureAccountContext() });
      setContacts([blankContact()]);
      setDirections('');
      mutationId.current = null;
      setOpen(false);
      toast.success('Contacts saved to Survey for calling');
      await Promise.all(['inventory-folders', 'inventory-folder-items', 'broker-today'].map((key) => client.invalidateQueries({ queryKey: [key] })));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  return (
    <>
      <Button disabled={!allowed} variant="secondary" onClick={() => setOpen(true)}>
        <Phone className="size-4" /> Add survey phone
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving.current) {
            if (!value) setReadingLocation(false);
            setOpen(value);
          }
        }}
        title="Add survey phone"
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {contacts.map((contact, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
              {(['name', 'phone'] as const).map((key) => (
                <label key={key} className="block text-sm font-semibold">
                  {key === 'phone' ? 'Phone number' : 'Name'} {index + 1}
                  <input
                    type={key === 'phone' ? 'tel' : 'text'}
                    value={contact[key]}
                    maxLength={key === 'phone' ? 25 : 200}
                    disabled={busy}
                    onChange={(event) => {
                      setContacts(contacts.map((row, i) => (i === index ? { ...row, [key]: event.target.value } : row)));
                      mutationId.current = null;
                      setError('');
                    }}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-3"
                  />
                </label>
              ))}
              {contacts.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setContacts(contacts.filter((_, i) => i !== index));
                    mutationId.current = null;
                  }}
                >
                  Remove contact {index + 1}
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || contacts.length >= 30}
            onClick={() => setContacts([...contacts, blankContact()])}
          >
            <Plus className="size-4" /> Add contact
          </Button>
          {open && (
            <SurveyLocationField
              value={directions}
              disabled={busy}
              onReading={setReadingLocation}
              onChange={(link) => {
                setDirections(link);
                mutationId.current = null;
                setError('');
              }}
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
          <Button type="submit" disabled={readingLocation} loading={busy}>
            Save to Survey
          </Button>
        </form>
      </Dialog>
    </>
  );
}
