'use client';
import { useState, useRef } from 'react';
import { INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, prepareInventoryEditorInput, inventoryEditorPatch, type InventoryInput, type LedgerItem } from '@brokeriq/shared';
import { errorMessage } from '@/lib/api';

import { PropertyExtras, readPropertyExtras } from './property-extras';

const numeric = ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'];
const inputs = [
  ['sector', 'Sector / locality'],
  ['houseNo', 'House / plot no.'],
  ['unitLabel', 'Unit'],
  ['address', 'Address'],
  ['floor', 'Floor'],
  ['bhk', 'Rooms'],
  ['area', 'Area'],
  ['monthlyRent', 'Monthly rent ₹'],
  ['totalSalePrice', 'Total sale price ₹'],
  ['ratePerArea', 'Rate per area ₹'],
  ['securityDeposit', 'Deposit ₹'],
];
const options: Record<string, string[]> = {
  purpose: ['RENT', 'SALE'],
  category: ['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND'],
  propertyType: PROPERTY_TYPES,
  roomKind: ['BHK', 'RK', 'STUDIO'],
  furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'],
  areaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
  rateAreaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
  availability: ['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE'],
  status: ['DRAFT', 'ACTIVE', 'INACTIVE'],
};
export function PropertyForm({
  initial = {},
  onSave,
  label = 'Save property',
  onDirty,
}: {
  initial?: InventoryInput | LedgerItem;
  onSave: (input: InventoryInput) => Promise<void>;
  label?: string;
  onDirty?: () => void;
}) {
  const mutationId = useRef(initial.clientMutationId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : undefined));
  const [contacts, setContacts] = useState<NonNullable<InventoryInput['contacts']>>(() => {
    const normalized = prepareInventoryEditorInput({ contacts: initial.contacts ?? [] }).contacts as NonNullable<InventoryInput['contacts']>;
    return normalized.length ? normalized : [{ name: '', phone: '', role: 'UNKNOWN' }];
  });
  const [purpose, setPurpose] = useState(initial.purpose ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values: Record<string, any> = Object.fromEntries(new FormData(event.currentTarget));
    for (const key of Object.keys(values))
      if (key !== 'status' && key !== 'availability') values[key] = values[key] === '' ? null : numeric.includes(key) ? Number(values[key]) : values[key];
    for (const key of Object.keys(values)) if (key.startsWith('details.')) delete values[key];
    Object.assign(values, readPropertyExtras(event.currentTarget));
    // Keep source amenities which have no checkbox in the current taxonomy.
    values.amenities = [...new Set([...(initial.amenities ?? []).filter((a) => !event.currentTarget.querySelector(`input[name="amenities"][value="${CSS.escape(a)}"]`)), ...values.amenities])];
    values.contacts = contacts.filter((c) => c.name || c.phone || c.note || c.role !== 'UNKNOWN');
    Object.assign(values, prepareInventoryEditorInput(values));
    if ('revision' in initial) values.expectedRevision = initial.revision;
    else values.clientMutationId = mutationId.current;
    try {
      await onSave(('revision' in initial ? inventoryEditorPatch(values, initial) : values) as InventoryInput);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} onChange={onDirty} className="space-y-5">
      <p className="section-kicker">Property & pricing</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {inputs
          .filter(([name]) => !(purpose === 'RENT' && ['totalSalePrice', 'ratePerArea'].includes(name)) && !(purpose === 'SALE' && name === 'monthlyRent'))
          .map(([name, title]) => (
            <label key={name} className="text-xs font-semibold text-muted">
              {title}
              <input
                name={name}
                type={numeric.includes(name) ? 'number' : 'text'}
                min={numeric.includes(name) ? 0 : undefined}
                step={numeric.includes(name) ? 'any' : undefined}
                defaultValue={(initial as any)[name] ?? ''}
                className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
              />
            </label>
          ))}
        {Object.entries(options).map(([name, choices]) => (
          <label key={name} className="text-xs font-semibold text-muted">
            {(
              {
                purpose: 'Transaction',
                category: 'Category',
                propertyType: 'Property type',
                roomKind: 'Room configuration',
                furnishing: 'Furnishing',
                areaUnit: 'Area unit',
                rateAreaUnit: 'Rate area unit',
                availability: 'Availability',
                status: 'Record status',
              } as Record<string, string>
            )[name] ?? name}
            <select
              name={name}
              onChange={name === 'purpose' ? (e) => setPurpose(e.target.value) : undefined}
              defaultValue={(initial as any)[name] ?? (name === 'availability' ? 'UNKNOWN' : name === 'status' ? 'DRAFT' : '')}
              className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
            >
              {!['availability', 'status'].includes(name) && <option value="">Unknown / not recorded</option>}
              {choices.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div>
        <p className="mb-1 font-semibold">Private contacts</p>
        <p className="mb-3 text-xs text-muted">These contacts stay in your firm. Choose a separate public contact when publishing.</p>
        {contacts.map((contact, index) => (
          <div key={index} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              aria-label={`Contact ${index + 1} name`}
              placeholder="Name, if known"
              value={contact.name ?? ''}
              onChange={(e) => setContacts(contacts.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))}
              className="rounded-lg border border-line bg-surface p-2 text-sm"
            />
            <input
              aria-label={`Contact ${index + 1} phone`}
              placeholder="Phone"
              value={contact.phone ?? ''}
              onChange={(e) => setContacts(contacts.map((c, i) => (i === index ? { ...c, phone: e.target.value } : c)))}
              className="rounded-lg border border-line bg-surface p-2 text-sm"
            />
            <select
              aria-label={`Contact ${index + 1} role`}
              value={contact.role}
              onChange={(e) => setContacts(contacts.map((c, i) => (i === index ? { ...c, role: e.target.value as any } : c)))}
              className="rounded-lg border border-line bg-surface p-2 text-sm"
            >
              <option value="UNKNOWN">Unknown role</option>
              <option value="OWNER">Owner</option>
              <option value="BROKER">Broker</option>
            </select>
            <button
              type="button"
              onClick={() => {
                onDirty?.();
                setContacts(contacts.filter((_, i) => i !== index));
              }}
              className="text-xs text-muted"
            >
              Remove contact
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            onDirty?.();
            setContacts([...contacts, { name: '', phone: '', role: 'UNKNOWN' }]);
          }}
          className="text-sm font-semibold text-brand-600"
        >
          + Add contact
        </button>
      </div>
      <PropertyExtras initial={initial} category={initial.category} />
      <label className="block text-xs font-semibold text-muted">
        Notes
        <textarea
          name="notes"
          defaultValue={initial.notes ?? ''}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-line bg-surface p-3 text-sm text-fg"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <div className="sticky -bottom-6 -mx-6 border-t border-line bg-surface/95 p-4 backdrop-blur">
        <button disabled={busy} className="min-h-11 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </form>
  );
}
