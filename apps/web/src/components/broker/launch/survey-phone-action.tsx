'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import { surveyPhoneInputSchema } from '@brokeriq/shared';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export function SurveyPhoneAction({ allowed, sector }: { allowed: boolean; sector?: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationId = useRef<string | null>(null);
  const saving = useRef(false);

  async function save() {
    if (!allowed || saving.current) return;
    mutationId.current ??= crypto.randomUUID();
    const parsed = surveyPhoneInputSchema.safeParse({ phone, sector, clientMutationId: mutationId.current });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await api('/inventory/survey-phone', { method: 'POST', body: parsed.data, ownerContext: captureAccountContext() });
      setPhone('');
      mutationId.current = null;
      setOpen(false);
      toast.success('Phone saved to Survey for calling');
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
          if (!saving.current) setOpen(value);
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
          <label className="block text-sm font-semibold">
            Owner phone number
            <input
              type="tel"
              value={phone}
              maxLength={25}
              disabled={busy}
              required
              onChange={(event) => {
                setPhone(event.target.value);
                mutationId.current = null;
                setError('');
              }}
              className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-3"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy}>
            Save to Survey
          </Button>
        </form>
      </Dialog>
    </>
  );
}
