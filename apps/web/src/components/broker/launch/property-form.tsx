'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES,
  prepareInventoryEditorInput,
  inventoryEditorPatch,
  inventoryNavigation,
  inventoryMonth,
  inventoryMonthSchema,
  missingInventoryFolderFields,
  isPendingSurvey,
  surveySectors,
  inventoryUnitBatchSchema,
  inventoryUnitConfiguration,
  inventoryUnitConfigurationFields,
  inventoryUnitLimit,
  surveyConfigurationChoices,
  readableValue,
  type AdditionalInventoryUnit,
  type UnitConfiguration,
  type InventoryInput,
  type LedgerItem,
} from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { hasDelegatedAccess, firmRoleLabel } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';

import { InventoryHierarchyPicker } from './inventory-hierarchy-picker';
import { PropertyExtras, readPropertyExtras } from './property-extras';
import { PropertyMedia } from './property-media';
import { SurveyLocationField } from './survey-location-field';
import { SurveyPropertyMatches } from './survey-property-matches';
import { InventoryFolderControls, useInventoryFolderDefinitions } from './inventory-folder-controls';
import { InventoryUnitFields } from './inventory-unit-fields';

const numeric = ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'];
const inputs = [
  ['sector', 'Sector / locality'],
  ['houseNo', 'House / plot no.'],
  ['unitLabel', 'Unit'],
  ['address', 'Address'],
  ['directionsUrl', 'Directions link or latitude, longitude'],
  ['floor', 'Floor'],
  ['bhk', 'BHK / number of rooms'],
  ['area', 'Area'],
  ['monthlyRent', 'Monthly rent ₹'],
  ['totalSalePrice', 'Total sale price ₹'],
  ['ratePerArea', 'Rate per area ₹'],
  ['securityDeposit', 'Deposit ₹'],
  ['brokerage', 'Brokerage'],
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
  survey = false,
  captureSurveyLocation = false,
  ownerMode = false,
  allowUnits = false,
}: {
  initial?: InventoryInput | LedgerItem;
  onSave: (input: InventoryInput, additionalUnits?: AdditionalInventoryUnit[]) => Promise<void>;
  label?: string;
  onDirty?: () => void;
  activateInMonth?: string;
  markRented?: boolean;
  requireAvailability?: boolean;
  survey?: boolean;
  captureSurveyLocation?: boolean;
  ownerMode?: boolean;
  allowUnits?: boolean;
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
    return normalized.length ? normalized : [{ name: '', phone: '', role: 'OWNER' }];
  });
  const [activate, setActivate] = useState(Boolean(activateInMonth));
  const [purpose, setPurpose] = useState(initial.purpose ?? '');
  const [location, setLocation] = useState({ sector: initial.sector, houseNo: initial.houseNo, address: initial.address });
  const folders = useInventoryFolderDefinitions(!ownerMode && !isSuper);
  const [customFolderId, setCustomFolderId] = useState(initial.customFolderId ?? '');
  const sectors = (folders.data ?? []).filter(({ kind }) => kind === 'SECTOR').map(({ label }) => label);
  const localities = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<{ name: string }[]>('/public/localities', { auth: false }),
    enabled: survey,
    staleTime: 600_000,
  });
  const navigation = inventoryNavigation(location);
  const [photos, setPhotos] = useState(initial.photoUrls ?? []);
  const [videos, setVideos] = useState(initial.videoUrls ?? []);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [unitUploading, setUnitUploading] = useState<number | null>(null);
  const [units, setUnits] = useState<Partial<AdditionalInventoryUnit>[]>([]);
  const [configuration, setConfiguration] = useState<UnitConfiguration | 'CUSTOM' | ''>(inventoryUnitConfiguration(initial) ?? '');
  const uploading = photoUploading || videoUploading || unitUploading !== null;
  const [busy, setBusy] = useState(false);
  const [directions, setDirections] = useState(initial.directionsUrl ?? '');
  const [readingLocation, setReadingLocation] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading || readingLocation) return;
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    let values: Record<string, any> = Object.fromEntries(new FormData(form));
    const originalDate = initial.date ? new Date(new Date(initial.date).getTime() + 330 * 60000).toISOString().slice(0, 10) : '';
    if (values.date) values.date = values.date === originalDate ? initial.date : new Date(`${values.date}T00:00:00+05:30`).toISOString();
    for (const key of Object.keys(values))
      if (key !== 'status' && key !== 'availability') values[key] = values[key] === '' ? null : numeric.includes(key) ? Number(values[key]) : values[key];
    for (const key of Object.keys(values)) if (key.startsWith('details.')) delete values[key];
    Object.assign(values, readPropertyExtras(form), { photoUrls: photos, videoUrls: videos });
    if (allowUnits && !survey && configuration && configuration !== 'CUSTOM') Object.assign(values, inventoryUnitConfigurationFields(configuration));
    if (survey) {
      values.details = { ...initial.details, ...values.details };
      if (!('revision' in initial))
        Object.assign(values, {
          ...initial,
          ...values,
          survey: true,
          purpose: initial.purpose ?? 'RENT',
          ...(values.bhk ? { roomKind: initial.roomKind ?? 'BHK', category: initial.category ?? 'RESIDENTIAL' } : {}),
        });
    }
    // Keep source amenities which have no checkbox in the current taxonomy.
    values.amenities = [
      ...new Set([...(initial.amenities ?? []).filter((a) => !form.querySelector(`input[name="amenities"][value="${CSS.escape(a)}"]`)), ...values.amenities]),
    ];
    if (isSuper) values.assignedToId = superAssignee || null;
    if (!ownerMode) values.contacts = contacts.filter((c) => c.name?.trim() || c.phone?.trim() || c.note?.trim());
    values = prepareInventoryEditorInput(values);
    if ('revision' in initial) values.expectedRevision = initial.revision;
    else values.clientMutationId = mutationId.current;
    try {
      if (activate) {
        if (!inventoryMonthSchema.safeParse(values.directoryMonth).success) throw new Error('Choose the year and month for this property.');
        const missing = missingInventoryFolderFields({ ...initial, ...values });
        if (missing.length) {
          const additional = form.querySelector('details');
          if (additional) additional.open = true;
          throw new Error('Fill these fields to make the property Available: ' + missing.join(', '));
        }
      }
      if (markRented) {
        const missing = missingInventoryFolderFields({ ...initial, ...values });
        if (missing.length && !('sourceType' in initial && isPendingSurvey(initial)))
          throw new Error('Fill these fields to mark the property Rented out: ' + missing.join(', '));
        if (
          'publishedListing' in initial &&
          initial.publishedListing?.status === 'ACTIVE' &&
          !window.confirm('Mark rented out and withdraw the public listing?')
        )
          return;
      }
      const payload = 'revision' in initial ? inventoryEditorPatch(values, initial) : values;
      const property = {
        ...payload,
        ...(activate ? { directoryMonth: values.directoryMonth } : {}),
        ...(markRented ? { status: 'RENTED', availability: 'RENTED' } : {}),
      } as InventoryInput;
      if (units.length) {
        const batch = inventoryUnitBatchSchema.safeParse({ property, units, clientMutationId: mutationId.current });
        if (!batch.success) throw new Error(batch.error.issues[0].message);
        await onSave(batch.data.property, batch.data.units);
      } else {
        await onSave(property);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const field = (key: string) => {
    const [name, title] = inputs.find(([name]) => name === key)!;
    return (
      <label key={name} className="text-xs font-semibold text-muted">
        {title}
        <input
          name={name}
          type={numeric.includes(name) ? 'number' : 'text'}
          min={numeric.includes(name) ? 0 : undefined}
          step={numeric.includes(name) ? 'any' : undefined}
          onChange={
            ['sector', 'houseNo', 'address'].includes(name) ? (event) => setLocation((current) => ({ ...current, [name]: event.target.value })) : undefined
          }
          {...(name === 'sector' ? { value: location.sector ?? '' } : { defaultValue: (initial as any)[name] ?? (name === 'monthlyRent' ? (initial.rent ?? '') : '') })}
          className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
        />
      </label>
    );
  };
  const select = (name: string) => {
    const choices = options[name];
    return (
      <label key={name} className="text-xs font-semibold text-muted">
        {(
          {
            purpose: 'Transaction',
            category: 'Category',
            propertyType: 'Property type',
            roomKind: 'Property configuration',
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
    );
  };
  const contactFields = (
    <div>
      <p className="mb-1 font-semibold">Owner details</p>
      <p className="mb-3 text-xs text-muted">These contacts stay in your firm. Choose a separate public contact when publishing.</p>
      {contacts.map((contact, index) => (
        <div key={index} className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <input
            aria-label={`${contact.role === 'OWNER' ? 'Owner' : 'Contact'} ${index + 1} name`}
            placeholder="Name, if known"
            value={contact.name ?? ''}
            onChange={(e) => setContacts(contacts.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))}
            className="rounded-lg border border-line bg-surface p-2 text-sm"
          />
          <input
            aria-label={`${contact.role === 'OWNER' ? 'Owner' : 'Contact'} ${index + 1} phone`}
            type="tel"
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
          setContacts([...contacts, { name: '', phone: '', role: 'OWNER' }]);
        }}
        disabled={contacts.length >= 30}
        className="text-sm font-semibold text-brand-600 disabled:opacity-50"
      >
        + Add contact
      </button>
    </div>
  );
  return (
    <form onSubmit={submit} onChange={onDirty} className="space-y-4">
      {!ownerMode && !isSuper && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted">
            Custom folder
            <select name="customFolderId" value={customFolderId} onChange={(event) => setCustomFolderId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-fg">
              <option value="">None</option>
              {customFolderId && !folders.data?.some(({ id }) => id === customFolderId) && <option value={customFolderId}>Selected folder</option>}
              {folders.data?.filter(({ kind }) => kind === 'CUSTOM').map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
            </select>
          </label>
          <InventoryFolderControls onCreated={(folder) => {
            if (folder.kind === 'CUSTOM') setCustomFolderId(folder.id);
            else setLocation((values) => ({ ...values, sector: folder.label }));
            onDirty?.();
          }} />
        </div>
      )}
      <label className="block text-xs font-semibold text-muted">
        Possession date
        <input
          type="date"
          name="details.possessionDate"
          required={survey && !markRented && initial.availability !== 'RENTED'}
          defaultValue={typeof initial.details?.possessionDate === 'string' ? initial.details.possessionDate : ''}
          className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
        />
      </label>
      {survey ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-semibold text-muted">
            Sector / locality
            <select
              name="sector"
              required
              value={location.sector ?? ''}
              onChange={(event) => setLocation({ ...location, sector: event.target.value })}
              className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-fg"
            >
              <option value="">Choose sector</option>
              {surveySectors([...(location.sector ? [location.sector] : []), ...sectors, ...(localities.data ?? []).map((item) => item.name)]).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            {localities.isError && (
              <button type="button" className="mt-1 text-brand-600 underline" onClick={() => void localities.refetch()}>
                Retry sectors
              </button>
            )}
          </label>
          {field('houseNo')}
          {!ownerMode && (
            <div className="col-span-full empty:hidden"><SurveyPropertyMatches sector={location.sector} houseNo={location.houseNo}
              excludeId={'id' in initial ? initial.id : undefined} /></div>
          )}
          {captureSurveyLocation && (
            <div className="col-span-full">
              <SurveyLocationField value={directions} onChange={setDirections} disabled={busy} onReading={setReadingLocation} />
            </div>
          )}
          <div className="col-span-full rounded-xl border border-line p-3">{contactFields}</div>
          {field('bhk')}
          {select('furnishing')}
          {field('floor')}
          <PropertyExtras initial={initial} fieldKeys={['foodPreference', 'petFriendly']} />
        </div>
      ) : (
        <>
          {markRented && <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Check the property details before marking it rented out.</p>}
          {contactFields}

          <p className="section-kicker">Address details</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {field('sector')}
            {field('houseNo')}
            {field('address')}
          </div>
          <p className="section-kicker">{units.length ? 'Property details · Unit 1' : 'Property details'}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {select('purpose')}
            {select('propertyType')}
            {allowUnits && (
              <label className="text-xs font-semibold text-muted">
                Property configuration
                <select
                  className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
                  value={configuration}
                  onChange={(event) => setConfiguration(event.target.value as typeof configuration)}
                >
                  <option value="">Unknown / not recorded</option>
                  {surveyConfigurationChoices.map((choice) => (
                    <option key={choice} value={choice}>
                      {readableValue(choice)}
                    </option>
                  ))}
                  <option value="CUSTOM">Other configuration</option>
                </select>
              </label>
            )}
            {(!allowUnits || configuration === 'CUSTOM') && (
              <>
                {select('roomKind')}
                {field('bhk')}
              </>
            )}
            {select('furnishing')}
            {field('floor')}
            {purpose !== 'SALE' && field('monthlyRent')}
            {purpose !== 'RENT' && field('totalSalePrice')}
            <PropertyExtras initial={initial} quickFields />
            {!ownerMode && field('brokerage')}
            {field('directionsUrl')}
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-brand-600">
              {navigation.pinSearch && (
                <a href={navigation.pinSearch} target="_blank" rel="noreferrer">
                  Find property pin
                </a>
              )}
              {navigation.sectorMap && (
                <a href={navigation.sectorMap} target="_blank" rel="noreferrer">
                  Sector map
                </a>
              )}
            </div>
          </div>
        </>
      )}
      <div className="space-y-5 rounded-xl border border-line p-4">
        <PropertyMedia
          photoLabel={units.length ? 'Unit 1 photos' : undefined}
          camera={survey}
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
          disabled={busy || unitUploading !== null || (survey && !location.sector?.trim())}
        />
        {!survey && (
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
            disabled={busy || unitUploading !== null}
          />
        )}
      </div>
      {allowUnits && !survey && (
        <div className="space-y-3">
          {units.map((unit, index) => (
            <InventoryUnitFields
              key={index}
              unit={unit}
              number={index + 2}
              purpose={purpose}
              locked={busy || (uploading && unitUploading !== index)}
              uploading={uploading}
              onChange={(update) => {
                setUnits((rows) => rows.map((row, i) => (i === index ? update(row) : row)));
                onDirty?.();
              }}
              onUploading={(active) => setUnitUploading(active ? index : null)}
              onRemove={() => {
                setUnits((rows) => rows.filter((_, i) => i !== index));
                onDirty?.();
              }}
            />
          ))}
          <button
            type="button"
            className="action-secondary rounded-xl px-4 py-2 text-sm font-semibold"
            disabled={busy || uploading || units.length >= inventoryUnitLimit - 1}
            onClick={() => {
              setUnits((rows) => [...rows, {}]);
              onDirty?.();
            }}
          >
            + Add unit
          </button>
        </div>
      )}
      {!survey && (
        <PropertyExtras initial={initial} category={initial.category} separatePossession>
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
          {activate && <p className="text-sm text-muted">Available inventory requires category, area and unit.</p>}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {field('unitLabel')}
            {select('category')}
            {field('area')}
            {select('areaUnit')}
            {field('securityDeposit')}
            {purpose !== 'RENT' && field('ratePerArea')}
            {select('rateAreaUnit')}
            {!ownerMode && !activate && !markRented && select('availability')}
            {!ownerMode && !activate && !markRented && select('status')}
            {field('tenantPreference')}
            {!ownerMode && (
              <>
                <label className="text-xs font-semibold text-muted">
                  Record date · IST
                  <input
                    type="date"
                    name="date"
                    defaultValue={initial.date ? new Date(new Date(initial.date).getTime() + 330 * 60000).toISOString().slice(0, 10) : ''}
                    className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg"
                  />
                </label>
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
              </>
            )}
          </div>
          {!ownerMode && (
            <label className="block text-xs font-semibold text-muted">
              Notes
              <textarea
                name="notes"
                defaultValue={initial.notes ?? ''}
                rows={4}
                className="mt-1 block w-full rounded-lg border border-line bg-surface p-3 text-sm text-fg"
              />
            </label>
          )}
        </PropertyExtras>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <div className="sticky -bottom-6 -mx-6 border-t border-line bg-surface/95 p-4 backdrop-blur">
        <button
          disabled={busy || uploading || readingLocation}
          className="min-h-11 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </form>
  );
}
