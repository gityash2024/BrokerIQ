'use client';
import type { ReactNode } from 'react';
import { PROPERTY_FIELDS, PROPERTY_AMENITIES, visiblePropertyFields, type PropertyField } from '@brokeriq/shared';
const quickKeys = ['tenantType', 'foodPreference'];

function PropertyExtraField({ field: f, initial }: { field: PropertyField; initial: Record<string, any> }) {
  return (
    <label key={f.key} className="text-xs font-semibold text-muted">
      {f.label}
      {f.options || f.kind === 'boolean' ? (
        <select
          name={`details.${f.key}`}
          defaultValue={initial.details?.[f.key] == null ? '' : String(initial.details[f.key])}
          className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
        >
          <option value="">Not recorded</option>
          {(f.kind === 'boolean' ? ['true', 'false'] : f.options!).map((v) => (
            <option key={v} value={v}>
              {v === 'true' ? 'Yes' : v === 'false' ? 'No' : v.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={`details.${f.key}`}
          defaultValue={initial.details?.[f.key] ?? ''}
          type={f.kind === 'number' ? 'number' : f.key.endsWith('Date') || f.key === 'availableFrom' ? 'date' : 'text'}
          min={f.min}
          max={f.max}
          step={f.integer ? '1' : 'any'}
          className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
        />
      )}
    </label>
  );
}

export function PropertyExtras({
  initial,
  category,
  children,
  quickFields,
}: {
  initial: Record<string, any>;
  category?: string | null;
  children?: ReactNode;
  quickFields?: boolean;
}) {
  if (quickFields)
    return quickKeys.map((key) => <PropertyExtraField key={key} field={PROPERTY_FIELDS.find((field) => field.key === key)!} initial={initial} />);
  return (
    <details className="rounded-xl border border-line p-4">
      <summary className="cursor-pointer text-sm font-semibold">Additional property details</summary>
      <p className="my-3 text-xs text-muted">
        Only record known facts. Empty fields remain unknown. “Featured dealer” is a source label, not a BrokerIQ endorsement.
      </p>
      {children}
      <div className="grid gap-3 sm:grid-cols-2">
        {visiblePropertyFields(category)
          .filter((field) => !quickKeys.includes(field.key))
          .map((field) => (
            <PropertyExtraField key={field.key} field={field} initial={initial} />
          ))}
      </div>
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold">Amenities & facilities</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PROPERTY_AMENITIES.map((a) => (
            <label key={a} className="flex gap-2 text-xs">
              <input type="checkbox" name="amenities" value={a} defaultChecked={initial.amenities?.includes(a)} />
              {a.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </fieldset>
    </details>
  );
}
export function readPropertyExtras(form: HTMLFormElement) {
  const values = new FormData(form);
  const details: Record<string, any> = {};
  for (const f of PROPERTY_FIELDS) {
    const raw = values.get(`details.${f.key}`);
    if (raw !== null) details[f.key] = raw === '' ? null : f.kind === 'number' ? Number(raw) : f.kind === 'boolean' ? raw === 'true' : raw;
  }
  return {
    details,
    amenities: values.getAll('amenities').map(String),
  };
}
