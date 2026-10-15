'use client';
import { PROPERTY_FIELDS, PROPERTY_AMENITIES, visiblePropertyFields } from '@brokeriq/shared';
export function PropertyExtras({ initial, category }: { initial: Record<string, any>; category?: string | null }) {
  return (
    <details className="rounded-xl border border-line p-4">
      <summary className="cursor-pointer text-sm font-semibold">Additional property details, facilities & media</summary>
      <p className="my-3 text-xs text-muted">
        Only record known facts. Empty fields remain unknown. “Featured dealer” is a source label, not a BrokerIQ endorsement.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {visiblePropertyFields(category).map((f) => (
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
                step="any"
                className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
              />
            )}
          </label>
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
      {['photoUrls', 'videoUrls'].map((key) => (
        <label key={key} className="mt-4 block text-xs font-semibold">
          {key === 'photoUrls' ? 'Photo URLs (one per line)' : 'Video URLs (one per line)'}
          <textarea name={key} defaultValue={(initial[key] ?? []).join('\n')} rows={3} className="mt-1 w-full rounded-lg border border-line bg-surface p-3" />
        </label>
      ))}
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
    photoUrls: String(values.get('photoUrls') ?? '')
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    videoUrls: String(values.get('videoUrls') ?? '')
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
