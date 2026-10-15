'use client';
import { useState, useRef } from 'react';
import { type BrokerRequirementInput } from '@brokeriq/shared';
import { errorMessage } from '@/lib/api';
export function RequirementForm({
  initial = {},
  onSave,
  label = 'Save requirement',
  onDirty,
}: {
  initial?: Partial<BrokerRequirementInput>;
  onSave: (input: BrokerRequirementInput) => Promise<void>;
  label?: string;
  onDirty?: () => void;
}) {
  const mutationId = useRef(initial.clientMutationId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : undefined));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values: any = Object.fromEntries(new FormData(event.currentTarget));
    values.localityNames = values.localityNames
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    values.propertyTypes = values.propertyTypes
      .split(',')
      .map((s: string) => s.trim().toUpperCase())
      .filter(Boolean);
    values.bedrooms = values.bedrooms
      .split(',')
      .map((s: string) => Number(s.trim()))
      .filter((n: number) => n > 0);
    for (const key of ['minBudget', 'maxBudget', 'minArea', 'maxArea']) values[key] = values[key] === '' ? null : Number(values[key]);
    for (const key of ['contactName', 'contactPhone', 'roomKind', 'furnishing', 'areaUnit']) if (values[key] === '') values[key] = null;
    try {
      await onSave({ ...initial, ...values, clientMutationId: mutationId.current });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} onChange={onDirty} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['contactName', 'Contact name'],
          ['contactPhone', 'Contact phone'],
          ['localityNames', 'Localities, comma separated'],
          ['bedrooms', 'Room counts, comma separated'],
          ['propertyTypes', 'Property types, comma separated'],
          ['minBudget', 'Min budget ₹'],
          ['maxBudget', 'Max budget ₹'],
          ['minArea', 'Min area'],
          ['maxArea', 'Max area'],
        ].map(([name, title]) => (
          <label key={name} className="text-xs font-semibold">
            {title}
            <input
              name={name}
              type={/Budget|Area/.test(name) ? 'number' : 'text'}
              defaultValue={Array.isArray((initial as any)[name]) ? (initial as any)[name].join(', ') : ((initial as any)[name] ?? '')}
              className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
            />
          </label>
        ))}
        {Object.entries({
          purpose: ['RENT', 'SALE'],
          roomKind: ['BHK', 'RK', 'STUDIO'],
          furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'],
          areaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
        }).map(([name, choices]) => (
          <label key={name} className="text-xs font-semibold">
            {name}
            <select name={name} defaultValue={(initial as any)[name] ?? ''} className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5">
              <option value="">Not specified</option>
              {choices.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <textarea
        name="notes"
        aria-label="Requirement notes"
        rows={4}
        defaultValue={initial.notes ?? ''}
        className="w-full rounded-lg border border-line bg-surface p-3"
      />
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <button disabled={busy} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">
        {busy ? 'Saving…' : label}
      </button>
    </form>
  );
}
