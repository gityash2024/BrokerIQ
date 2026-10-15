'use client';
import { useState } from 'react';
import { INVENTORY_SORTS, PROPERTY_AMENITIES, visiblePropertyFields } from '@brokeriq/shared';
export function AdvancedFilters({ filters, onChange }: { filters: Record<string, string>; onChange: (filters: any) => void }) {
  const [tab, setTab] = useState('Location');
  const extra = filters.detailFilters ? JSON.parse(filters.detailFilters) : {};
  const fields = visiblePropertyFields(filters.category);
  const groups = ['Sort & source', ...new Set(fields.map((f) => f.group)), 'Amenities & media'];
  const set = (key: string, value: any) => {
    const next = { ...extra };
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) delete next[key];
    else next[key] = value;
    onChange({ ...filters, detailFilters: Object.keys(next).length ? JSON.stringify(next) : '' });
  };
  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="mb-3 text-sm font-semibold">More filters</p>
      <div className="flex gap-4">
        <div className="w-36 shrink-0 space-y-1">
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setTab(group)}
              className={`w-full rounded-lg p-2 text-left text-xs ${tab === group ? 'bg-brand-50 font-semibold text-brand-700' : 'text-muted'}`}
            >
              {group}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          {tab === 'Sort & source' ? (
            <>
              <label className="block text-xs">
                Sort by
                <select
                  className="mt-1 block w-full rounded-lg border border-line bg-surface p-2"
                  value={filters.sort ?? ''}
                  onChange={(e) => onChange({ ...filters, sort: e.target.value })}
                >
                  {INVENTORY_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Data verification
                <select
                  value={filters.verificationStatus ?? ''}
                  onChange={(e) => onChange({ ...filters, verificationStatus: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-line bg-surface p-2"
                >
                  <option value="">All</option>
                  <option value="VERIFIED">Reviewed data</option>
                  <option value="NEEDS_REVIEW">Needs review</option>
                </select>
              </label>
              {[
                ['minRate', 'Minimum ₹ / sq.ft.'],
                ['maxRate', 'Maximum ₹ / sq.ft.'],
              ].map(([key, label]) => (
                <label key={key} className="block text-xs">
                  {label}
                  <input
                    type="number"
                    min="0"
                    value={filters[key] ?? ''}
                    onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-line bg-surface p-2"
                  />
                </label>
              ))}
              <label className="block text-xs">
                Floor
                <input
                  value={filters.floor ?? ''}
                  onChange={(e) => onChange({ ...filters, floor: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-line bg-surface p-2"
                />
              </label>
            </>
          ) : tab === 'Amenities & media' ? (
            <>
              {[
                ['hasPhotos', 'With photos'],
                ['hasVideos', 'With videos'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={filters[key] === 'true'} onChange={(e) => onChange({ ...filters, [key]: e.target.checked ? 'true' : '' })} />
                  {label}
                </label>
              ))}
              {PROPERTY_AMENITIES.map((a) => {
                const selected = (filters.amenities ?? '').split(',').filter(Boolean);
                return (
                  <label key={a} className="flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.includes(a)}
                      onChange={(e) => onChange({ ...filters, amenities: (e.target.checked ? [...selected, a] : selected.filter((v) => v !== a)).join(',') })}
                    />
                    {a.replace(/_/g, ' ')}
                  </label>
                );
              })}
            </>
          ) : (
            fields
              .filter((f) => f.group === tab)
              .map((f) => (
                <fieldset key={f.key} className="space-y-2">
                  <legend className="text-xs font-semibold">{f.label}</legend>
                  {f.kind === 'number' ? (
                    <div className="flex gap-2">
                      {['min', 'max'].map((bound) => (
                        <input
                          key={bound}
                          aria-label={`${f.label} ${bound}`}
                          placeholder={bound === 'min' ? 'Min' : 'Max'}
                          type="number"
                          min={f.min}
                          max={f.max}
                          value={extra[f.key]?.[bound] ?? ''}
                          onChange={(e) => {
                            const range = { ...extra[f.key] };
                            if (e.target.value === '') delete range[bound];
                            else range[bound] = Number(e.target.value);
                            set(f.key, Object.keys(range).length ? range : null);
                          }}
                          className="w-1/2 rounded-lg border border-line bg-surface p-2 text-xs"
                        />
                      ))}
                    </div>
                  ) : f.options ? (
                    f.options.map((v) => {
                      const selected = Array.isArray(extra[f.key]) ? extra[f.key] : [];
                      return (
                        <label key={v} className="flex gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selected.includes(v)}
                            onChange={(e) => set(f.key, e.target.checked ? [...selected, v] : selected.filter((s: string) => s !== v))}
                          />
                          {v.replace(/_/g, ' ')}
                        </label>
                      );
                    })
                  ) : f.kind === 'boolean' ? (
                    <select
                      value={extra[f.key] == null ? '' : String(extra[f.key])}
                      onChange={(e) => set(f.key, e.target.value === '' ? null : e.target.value === 'true')}
                      className="w-full rounded-lg border border-line bg-surface p-2 text-xs"
                    >
                      <option value="">Any / unknown included</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      aria-label={f.label}
                      value={extra[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value)}
                      type={f.key.endsWith('Date') || f.key === 'availableFrom' ? 'date' : 'text'}
                      className="w-full rounded-lg border border-line bg-surface p-2 text-xs"
                    />
                  )}
                </fieldset>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
