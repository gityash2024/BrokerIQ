'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { toast } from 'sonner';

export function CreateBroker() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    try {
      await api('/admin/organizations', { body: Object.fromEntries(new FormData(form)) });
      form.reset();
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ['admin-orgs'] });
      toast.success('Broker account created');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-4">
        <button className="font-semibold text-brand-600" onClick={() => setOpen(!open)}>
          + Create broker
        </button>
        <Link href="/admin/broker-invites" className="text-sm text-muted">
          Invite broker →
        </Link>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ['name', 'Broker name', 'text'],
            ['firmName', 'Firm name', 'text'],
            ['email', 'Email', 'email'],
            ['password', 'Initial password', 'password'],
          ].map(([name, label, type]) => (
            <label key={name} className="text-sm">
              {label}
              <input
                required
                name={name}
                type={type}
                minLength={name === 'password' ? 8 : undefined}
                autoComplete={name === 'password' ? 'new-password' : undefined}
                className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
              />
            </label>
          ))}
          <button disabled={busy} className="rounded-lg bg-brand-600 p-3 font-semibold text-white">
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}
    </div>
  );
}
