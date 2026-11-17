'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES,
  prepareInventoryEditorInput,
  inventoryEditorPatch,
  inventoryDateSchema,
  inventoryDateLabel,
  inventoryMonth,
  inventoryMonthSchema,
  missingInventoryFolderFields,
  type InventoryInput,
  type LedgerItem,
} from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { hasDelegatedAccess, firmRoleLabel } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';

import { InventoryHierarchyPicker } from './inventory-hierarchy-picker';
import { PropertyExtras, readPropertyExtras } from './property-extras';
import { PropertyMedia } from './property-media';

const numeric = ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'];
const inputs = [
  ['sector', 'Sector / locality'],
  ['houseNo', 'House / plot no.'],
  ['unitLabel', 'Unit'],
  ['address', 'Address'],
  ['directionsUrl', 'Directions link · Google Maps or Apple Maps'],
  ['floor', 'Floor'],
  ['bhk', 'Rooms'],
  ['area', 'Area'],
  ['monthlyRent', 'Monthly rent ₹'],
  ['totalSalePrice', 'Total sale price ₹'],
  ['ratePerArea', 'Rate per area ₹'],
  ['securityDeposit', 'Deposit ₹'],
  ['brokerage', 'Brokerage terms'],
  ['tenantPreference', 'Tenant preference'],
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
  activateInMonth,
  markRented = false,
  requireAvailability = false,
}: {
  initial?: InventoryInput | LedgerItem;
  onSave: (input: InventoryInput) => Promise<void>;
  label?: string;
  onDirty?: () => void;
  activateInMonth?: string;
  markRented?: boolean;
  requireAvailability?: boolean;
}) {
  const { user } = useAuth();
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const isAdmin = user?.role === 'BROKER_ADMIN' || (delegated && hasDelegatedAccess(user, 'inventory', 'assign'));
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [superAssignee, setSuperAssignee] = useState(initial.assignedToId ?? '');
  const team = useQuery({
    queryKey: ['broker-team', 'inventory-assignees', user?.id],
    queryFn: () => api<any>(delegated ? '/inventory/assignees' : '/broker/team'),
    enabled: isAdmin,
  });
  const teamMembers: any[] = (Array.isArray(team.data) ? team.data : (team.data as any)?.members) || [];
  const mutationId = useRef(initial.clientMutationId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : undefined));
  const [contacts, setContacts] = useState<NonNullable<InventoryInput['contacts']>>(() => {
    const normalized = prepareInventoryEditorInput({ contacts: initial.contacts ?? [] }).contacts as NonNullable<InventoryInput['contacts']>;
    return normalized.length ? normalized : [{ name: '', phone: '', role: 'UNKNOWN' }];
  });
  const [activate, setActivate] = useState(Boolean(activateInMonth));
  const [purpose, setPurpose] = useState(initial.purpose ?? '');
  const [availability, setAvailability] = useState(initial.availability ?? 'UNKNOWN');
  const showAvailabilityDate = !markRented && (activate || availability === 'AVAILABLE');
  const lockedDate = initial.availability === 'AVAILABLE' ? initial.availableSince : null;
  const [photos, setPhotos] = useState(initial.photoUrls ?? []);
  const [videos, setVideos] = useState(initial.videoUrls ?? []);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const uploading = photoUploading || videoUploading;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    setError('');
    let values: Record<string, any> = Object.fromEntries(new FormData(event.currentTarget));
    const originalDate = initial.date ? new Date(new Date(initial.date).getTime() + 330 * 60000).toISOString().slice(0, 10) : '';
    if (values.date) values.date = values.date === originalDate ? initial.date : new Date(`${values.date}T00:00:00+05:30`).toISOString();
    for (const key of Object.keys(values))
      if (key !== 'status' && key !== 'availability') values[key] = values[key] === '' ? null : numeric.includes(key) ? Number(values[key]) : values[key];
    for (const key of Object.keys(values)) if (key.startsWith('details.')) delete values[key];
    Object.assign(values, readPropertyExtras(event.currentTarget), { photoUrls: photos, videoUrls: videos });
    // Keep source amenities which have no checkbox in the current taxonomy.
    values.amenities = [
      ...new Set([
        ...(initial.amenities ?? []).filter((a) => !event.currentTarget.querySelector(`input[name="amenities"][value="${CSS.escape(a)}"]`)),
        ...values.amenities,
      ]),
    ];
    if (isSuper) values.assignedToId = superAssignee || null;
    values.contacts = contacts.filter((c) => c.name || c.phone || c.note || c.role !== 'UNKNOWN');
    values = prepareInventoryEditorInput(values);
    if ('revision' in initial) values.expectedRevision = initial.revision;
    else values.clientMutationId = mutationId.current;
    try {
      if (
        showAvailabilityDate &&
        !lockedDate &&
        (activate || initial.availability !== 'AVAILABLE') &&
        !inventoryDateSchema.safeParse(values.availableSince).success
      ) {
        throw new Error('Choose the date this property became available.');
      }
      if (activate) {
        if (!inventoryMonthSchema.safeParse(values.directoryMonth).success) throw new Error('Choose the year and month for this property.');
        const missing = missingInventoryFolderFields({ ...initial, ...values });
        if (missing.length) throw new Error('Fill these fields to make the property Available: ' + missing.join(', '));
      }
      if (markRented) {
        const missing = missingInventoryFolderFields({ ...initial, ...values });
        if (missing.length) throw new Error('Fill these fields to mark the property Rented out: ' + missing.join(', '));
        if (
          'publishedListing' in initial &&
          initial.publishedListing?.status === 'ACTIVE' &&
          !window.confirm('Mark rented out and withdraw the public listing?')
        )
          return;
      }
      const payload = 'revision' in initial ? inventoryEditorPatch(values, initial) : values;
      await onSave({
        ...payload,
        ...(activate ? { directoryMonth: values.directoryMonth } : {}),
        ...(markRented ? { status: 'RENTED', availability: 'RENTED' } : {}),
      } as InventoryInput);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} onChange={onDirty} className="space-y-5">
      {markRented && <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Check the property details before marking it rented out.</p>}
      {activateInMonth && (
        <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-4 sm:grid-cols-2">
          {!requireAvailability && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} />
              Make available
            </label>
          )}
          {activate && (
            <label className="text-xs font-semibold">
              Inventory year and month
              <input
                name="directoryMonth"
                type="month"
                required
                defaultValue={activateInMonth || inventoryMonth()}
                className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>
      )}
      {activate && <p className="text-sm text-muted">Review the details below before making this property available.</p>}
      {showAvailabilityDate && (
        <div className="max-w-sm">
          {lockedDate ? (
            <>
              <p className="text-xs font-semibold text-muted">Available since</p>
              <p className="mt-1 text-sm font-semibold">{inventoryDateLabel(lockedDate)}</p>
              <p className="mt-1 text-xs text-muted">This date stays fixed while the property is available.</p>
            </>
          ) : (
            <label className="block text-xs font-semibold text-muted">
              Available since
              <input
                name="availableSince"
                type="date"
                required={activate || initial.availability !== 'AVAILABLE'}
                className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>
      )}
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
                defaultValue={(initial as any)[name] ?? (name === 'monthlyRent' ? (initial.rent ?? '') : '')}
                className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
              />
            </label>
          ))}
        <label className="text-xs font-semibold text-muted">
          Record date · IST
          <input
            type="date"
            name="date"
            defaultValue={initial.date ? new Date(new Date(initial.date).getTime() + 330 * 60000).toISOString().slice(0, 10) : ''}
            className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
          />
        </label>
        {Object.entries(options)
          .filter(([name]) => (!activate && !markRented) || !['availability', 'status'].includes(name))
          .map(([name, choices]) => (
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
                onChange={(event) => {
                  if (name === 'purpose') setPurpose(event.target.value);
                  if (name === 'availability') setAvailability(event.target.value as typeof availability);
                }}
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
        {isSuper ? (
          <InventoryHierarchyPicker
            kind="members"
            organizationId={initial.organizationId}
            value={superAssignee}
            onChange={(id) => {
              setSuperAssignee(id);
              onDirty?.();
            }}
            selectedLabel={'assignedTo' in initial ? initial.assignedTo?.name : undefined}
          />
        ) : isAdmin ? (
          <label className="text-xs font-semibold text-muted">
            Assignee (Agent / Admin)
            <select
              name="assignedToId"
              defaultValue={(initial as any).assignedToId ?? (initial as any).assignedTo?.id ?? user?.id ?? ''}
              className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
            >
              <option value={user?.id ?? ''}>You ({user?.name || 'Current User'}) (Default)</option>
              {teamMembers.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email || m.phone} ({firmRoleLabel(m.role)})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="text-xs font-semibold text-muted">
            Assignee
            <div className="mt-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg">
              {(initial as any).assignedTo?.name || user?.name || 'You'} (Assigned) · Only Admin can re-assign
            </div>
            {!delegated && (
              <input type="hidden" name="assignedToId" value={(initial as any).assignedToId ?? (initial as any).assignedTo?.id ?? user?.id ?? ''} />
            )}
          </div>
        )}
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
      <div className="space-y-5 rounded-xl border border-line p-4">
        <PropertyMedia
          urls={photos}
          onUploading={setPhotoUploading}
          onAdd={(url) => {
            setPhotos((current) => [...current, url]);
            onDirty?.();
          }}
          onRemove={(index) => {
            setPhotos((current) => current.filter((_, i) => i !== index));
            onDirty?.();
          }}
          disabled={busy}
        />
        <PropertyMedia
          video
          urls={videos}
          onUploading={setVideoUploading}
          onAdd={(url) => {
            setVideos((current) => [...current, url]);
            onDirty?.();
          }}
          onRemove={(index) => {
            setVideos((current) => current.filter((_, i) => i !== index));
            onDirty?.();
          }}
          disabled={busy}
        />
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
        <button disabled={busy || uploading} className="min-h-11 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </form>
  );
}
