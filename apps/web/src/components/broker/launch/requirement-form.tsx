'use client';
import { useState, useRef } from 'react';
import { brokerRequirementSchema, INVENTORY_PROPERTY_TYPES, readableValue, type BrokerRequirementInput } from '@brokeriq/shared';
import { errorMessage } from '@/lib/api';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { ClipboardList, UserRound, IndianRupee, Ruler } from 'lucide-react';
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [types, setTypes] = useState<string[]>(initial.propertyTypes ?? []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values: any = Object.fromEntries(new FormData(event.currentTarget));
    values.localityNames = values.localityNames
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    values.propertyTypes = types;
    values.bedrooms = values.bedrooms
      .split(',')
      .map((s: string) => Number(s.trim()))
      .filter((n: number) => n > 0);
    for (const key of ['minBudget', 'maxBudget', 'minArea', 'maxArea']) values[key] = values[key] === '' ? null : Number(values[key]);
    for (const key of ['contactName', 'contactPhone', 'roomKind', 'furnishing', 'areaUnit']) if (values[key] === '') values[key] = null;
    try {
      const parsed = brokerRequirementSchema.safeParse({ ...initial, ...values, clientMutationId: mutationId.current });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (!parsed.data.purpose || !parsed.data.localityNames.length) throw new Error('Choose a transaction and at least one preferred locality.');
      await onSave(parsed.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const number = (name: 'minBudget' | 'maxBudget' | 'minArea' | 'maxArea', title: string) => (
    <Field label={title}>
      <Input name={name} type="number" min={0} step="any" defaultValue={initial[name] ?? ''} />
    </Field>
  );
  return (
    <form onSubmit={submit} onChange={onDirty} className="space-y-5">
      <p className="rounded-xl bg-brand-500/5 p-4 text-xs leading-5 text-muted">
        Keep each client need separate. Matching uses the recorded locality, budget and configuration; unknown availability remains clearly marked.
      </p>
      <fieldset disabled={busy} className="space-y-5">
        <section className="rounded-2xl border border-line p-4">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold">
            <UserRound className="size-4 text-brand-600" />
            Contact
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name">
              <Input name="contactName" autoComplete="name" defaultValue={initial.contactName ?? ''} />
            </Field>
            <Field label="Contact phone">
              <Input name="contactPhone" type="tel" autoComplete="tel" defaultValue={initial.contactPhone ?? ''} />
            </Field>
          </div>
        </section>
        <section className="rounded-2xl border border-line p-4">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold">
            <ClipboardList className="size-4 text-brand-600" />
            Property preferences
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Transaction" required>
              <Select name="purpose" defaultValue={initial.purpose ?? ''}>
                <option value="">Choose transaction</option>
                <option value="RENT">Rent</option>
                <option value="SALE">Sale</option>
              </Select>
            </Field>
            <Field label="Room type">
              <Select name="roomKind" defaultValue={initial.roomKind ?? ''}>
                <option value="">Any room type</option>
                {['BHK', 'RK', 'STUDIO'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Preferred localities" required hint="Separate multiple localities with commas">
              <Input name="localityNames" defaultValue={initial.localityNames?.join(', ') ?? ''} placeholder="Sector 45, Sector 46" />
            </Field>
            <Field label="Preferred room counts" hint="Separate multiple counts with commas">
              <Input name="bedrooms" defaultValue={initial.bedrooms?.join(', ') ?? ''} placeholder="2, 3" />
            </Field>
            <Field label="Furnishing">
              <Select name="furnishing" defaultValue={initial.furnishing ?? ''}>
                <option value="">Any furnishing</option>
                {['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'].map((value) => (
                  <option key={value} value={value}>
                    {readableValue(value)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold">Property types</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...INVENTORY_PROPERTY_TYPES, ...types])).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={types.includes(value)}
                onClick={() => {
                  setTypes((current) => (current.includes(value) ? current.filter((type) => type !== value) : [...current, value]));
                  onDirty?.();
                }}
                className={`min-h-11 rounded-xl border px-3 text-xs font-medium ${types.includes(value) ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-muted'}`}
              >
                {readableValue(value)}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-line p-4">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold">
            <IndianRupee className="size-4 text-brand-600" />
            Budget & area
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {number('minBudget', 'Minimum budget ₹')}
            {number('maxBudget', 'Maximum budget ₹')}
            {number('minArea', 'Minimum area')}
            {number('maxArea', 'Maximum area')}
            <Field label="Area unit">
              <Select name="areaUnit" defaultValue={initial.areaUnit ?? ''}>
                <option value="">Choose area unit</option>
                {['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'].map((value) => (
                  <option key={value} value={value}>
                    {readableValue(value)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>
        <Field label="Requirement notes">
          <Textarea name="notes" rows={4} defaultValue={initial.notes ?? ''} />
        </Field>
      </fieldset>
      <div className="sticky bottom-0 -mx-1 border-t border-line bg-surface px-1 py-3">
        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-600">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">
          {label}
        </Button>
      </div>
    </form>
  );
}
