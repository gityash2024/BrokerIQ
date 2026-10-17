'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryPublishSchema, RENTABLE_TYPES, PROPERTY_TYPE_LABELS, type LedgerItem, type LocalityListItem } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select } from '@/components/ui/field';
export function PublicPublish({ item, onDone }: { item: LedgerItem; onDone: () => void }) {
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }) });
  const [preview, setPreview] = useState(false),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [value, setValue] = useState({
    title: item.sector ? `Rental property in ${item.sector}` : '',
    description: '',
    localityId: item.localityId ?? '',
    propertyType: item.propertyType ?? '',
    price: String(item.monthlyRent ?? ''),
    contactPhone: '',
    contactName: '',
    bedrooms: String(item.bhk ?? ''),
    floor: item.floor && /^-?\d+$/.test(item.floor) ? item.floor : '',
    photos: [] as { url: string }[],
  });
  const set = (key: string, v: any) => {
    setPreview(false);
    setAccepted(false);
    setValue({ ...value, [key]: v });
  };
  const parsed = () =>
    inventoryPublishSchema.safeParse({
      ...value,
      price: Number(value.price),
      bedrooms: value.bedrooms === '' ? null : Number(value.bedrooms),
      floor: value.floor === '' ? null : Number(value.floor),
      expectedRevision: item.revision,
      confirmedAvailable: true,
      publicPreviewAccepted: true,
    });
  const ready = item.availability === 'AVAILABLE' && item.status === 'ACTIVE' && item.purpose === 'RENT';
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-4 text-xs leading-6 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
        Choose exactly what customers may see. Private contacts, register images and internal notes stay in your ledger. The listing goes through Admin review.
      </p>
      {!ready ? (
        <p role="alert" className="text-sm text-amber-700">
          First save this as an active rental and confirm availability.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Public title">
              <Input value={value.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Monthly rent ₹">
              <Input type="number" min="1" value={value.price} onChange={(e) => set('price', e.target.value)} />
            </Field>
            <Field label="Locality">
              <Select value={value.localityId} onChange={(e) => set('localityId', e.target.value)}>
                <option value="">Select locality</option>
                {locs.data?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Property type">
              <Select value={value.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                <option value="">Choose type</option>
                {RENTABLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bedrooms">
              <Input type="number" value={value.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
            </Field>
            <Field label="Floor (optional)">
              <Input type="number" value={value.floor} onChange={(e) => set('floor', e.target.value)} />
            </Field>
            <Field label="Public contact name">
              <Input value={value.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Public contact phone (+91)">
              <Input type="tel" placeholder="+91…" value={value.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            </Field>
          </div>
          <Field label="Public description">
            <Textarea value={value.description} onChange={(e) => set('description', e.target.value)} rows={4} />
          </Field>
          {!!item.photoUrls?.length && (
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-2 text-xs font-semibold">Choose public property photos</legend>
              <div className="flex flex-wrap gap-3">
                {item.photoUrls.map((url) => (
                  <label key={url} className="w-28 text-xs">
                    <img src={url} alt="Property photo available for publication" className="mb-2 aspect-square rounded-lg object-cover" />
                    <input
                      type="checkbox"
                      checked={value.photos.some((p) => p.url === url)}
                      onChange={(e) => set('photos', e.target.checked ? [...value.photos, { url }] : value.photos.filter((p) => p.url !== url))}
                    />{' '}
                    Publish photo
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              const p = parsed();
              if (!p.success) {
                setError(p.error.issues[0].message);
                return;
              }
              setError('');
              setPreview(true);
            }}
          >
            Review public preview
          </Button>
          {preview && (
            <section className="card space-y-3 p-5">
              <p className="section-kicker">CUSTOMER PREVIEW</p>
              <h3 className="font-display text-xl font-bold">{value.title}</h3>
              <p className="text-sm">
                ₹{Number(value.price).toLocaleString('en-IN')}/month · {locs.data?.find((l) => l.id === value.localityId)?.name}
              </p>
              <p className="whitespace-pre-wrap text-sm text-muted">{value.description}</p>
              <p className="text-xs">
                Public contact: {value.contactName} {value.contactPhone}
              </p>
              <label className="flex min-h-11 items-center gap-3 text-xs font-semibold">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I confirmed availability and approve these public
                details.
              </label>
              <Button
                disabled={!accepted}
                loading={busy}
                onClick={async () => {
                  const p = parsed();
                  if (!p.success) return;
                  setBusy(true);
                  try {
                    await api(`/inventory/${item.id}/publish`, { method: 'POST', body: p.data });
                    onDone();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Submit for Admin review
              </Button>
            </section>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
