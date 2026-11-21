'use client';

import { areaUnitSchema, readableValue, surveyConfigurationChoices, type AdditionalInventoryUnit } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { PropertyMedia } from './property-media';

type UnitDraft = Partial<AdditionalInventoryUnit>;
const control = 'mt-1 block min-h-10 w-full rounded-lg border border-line bg-surface px-2';

export function InventoryUnitFields({
  unit,
  number,
  purpose,
  locked,
  uploading,
  onChange,
  onRemove,
  onUploading,
}: {
  unit: UnitDraft;
  number: number;
  purpose: string;
  locked: boolean;
  uploading: boolean;
  onChange: (update: (unit: UnitDraft) => UnitDraft) => void;
  onRemove: () => void;
  onUploading: (active: boolean) => void;
}) {
  const set = <K extends keyof UnitDraft>(key: K, value: UnitDraft[K]) => onChange((row) => ({ ...row, [key]: value }));
  const price = purpose === 'SALE' ? 'totalSalePrice' : 'monthlyRent';
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">Unit {number}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="text-sm">
          Configuration
          <select
            required
            className={control}
            value={unit.configuration ?? ''}
            disabled={locked}
            onChange={(e) => set('configuration', (e.target.value || undefined) as UnitDraft['configuration'])}
          >
            <option value="">Not recorded</option>
            {surveyConfigurationChoices.map((choice) => (
              <option key={choice} value={choice}>
                {readableValue(choice)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Furnishing
          <select
            className={control}
            value={unit.furnishing ?? ''}
            disabled={locked}
            onChange={(e) => set('furnishing', (e.target.value || undefined) as UnitDraft['furnishing'])}
          >
            <option value="">Not recorded</option>
            {(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] as const).map((choice) => (
              <option key={choice} value={choice}>
                {readableValue(choice)}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ['floor', 'Floor'],
            ['unitLabel', 'Unit reference'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input className={control} maxLength={200} value={unit[key] ?? ''} disabled={locked} onChange={(e) => set(key, e.target.value)} />
          </label>
        ))}
        {(
          [
            [price, purpose === 'SALE' ? 'Total sale price ₹' : 'Monthly rent ₹'],
            ['area', 'Area'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              type="number"
              min={0}
              step="any"
              className={control}
              value={unit[key] ?? ''}
              disabled={locked}
              onChange={(e) => set(key, e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
        ))}
        <label className="text-sm">
          Area unit
          <select
            className={control}
            value={unit.areaUnit ?? ''}
            disabled={locked}
            onChange={(e) => set('areaUnit', (e.target.value || undefined) as UnitDraft['areaUnit'])}
          >
            <option value="">Not recorded</option>
            {areaUnitSchema.options.map((choice) => (
              <option key={choice} value={choice}>
                {readableValue(choice)}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="ghost" size="sm" disabled={locked || uploading} onClick={onRemove}>
          Remove unit
        </Button>
      </div>
      <PropertyMedia
        photoLabel={`Unit ${number} photos`}
        urls={unit.photoUrls ?? []}
        disabled={locked}
        onUploading={onUploading}
        onAdd={(url) => onChange((row) => ({ ...row, photoUrls: [...(row.photoUrls ?? []), url] }))}
        onRemove={(photo) => onChange((row) => ({ ...row, photoUrls: row.photoUrls?.filter((_, i) => i !== photo) }))}
      />
    </fieldset>
  );
}
