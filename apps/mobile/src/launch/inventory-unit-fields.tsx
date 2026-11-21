import { areaUnitSchema, surveyConfigurationChoices, type AdditionalInventoryUnit } from '@brokeriq/shared';
import { Button, Input, Row, Txt } from '@/ui';
import { ChoiceField } from './form';
import { NativePropertyMedia } from './property-media';
import { NativeCard } from './screen';

type NumericField = 'area' | 'monthlyRent' | 'totalSalePrice';
export type InventoryUnitDraft = Partial<Omit<AdditionalInventoryUnit, NumericField>> & Partial<Record<NumericField, string | number | null>>;
type UnitDraft = InventoryUnitDraft;

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
  purpose?: string;
  locked: boolean;
  uploading: boolean;
  onChange: (update: (unit: UnitDraft) => UnitDraft) => void;
  onRemove: () => void;
  onUploading: (active: boolean) => void;
}) {
  const set = <K extends keyof UnitDraft>(key: K, value: UnitDraft[K]) => onChange((row) => ({ ...row, [key]: value }));
  const price = purpose === 'SALE' ? 'totalSalePrice' : 'monthlyRent';
  return (
    <NativeCard style={{ gap: 8 }}>
      <Txt v="h3">Unit {number}</Txt>
      <Row align="flex-start" gap={8}>
        <ChoiceField
          paired
          label="Configuration"
          value={unit.configuration}
          choices={[...surveyConfigurationChoices]}
          access={!locked}
          onChange={(value) => set('configuration', (value ?? undefined) as UnitDraft['configuration'])}
        />
        <ChoiceField
          paired
          label="Furnishing"
          value={unit.furnishing}
          choices={['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']}
          access={!locked}
          onChange={(value) => set('furnishing', value as UnitDraft['furnishing'])}
        />
      </Row>
      <Row align="flex-start" gap={8}>
        <Input label="Floor" value={unit.floor ?? ''} editable={!locked} containerStyle={{ flex: 1 }} onChangeText={(value) => set('floor', value)} />
        <Input
          label="Unit reference"
          value={unit.unitLabel ?? ''}
          editable={!locked}
          containerStyle={{ flex: 1 }}
          onChangeText={(value) => set('unitLabel', value)}
        />
      </Row>
      <Input
        label={purpose === 'SALE' ? 'Total sale price ₹' : 'Monthly rent ₹'}
        keyboardType="decimal-pad"
        value={unit[price]?.toString() ?? ''}
        editable={!locked}
        onChangeText={(value) => set(price, value)}
      />
      <Row align="flex-start" gap={8}>
        <Input
          label="Area"
          keyboardType="decimal-pad"
          value={unit.area?.toString() ?? ''}
          editable={!locked}
          containerStyle={{ flex: 1 }}
          onChangeText={(value) => set('area', value)}
        />
        <ChoiceField
          paired
          label="Area unit"
          value={unit.areaUnit}
          choices={[...areaUnitSchema.options]}
          access={!locked}
          onChange={(value) => set('areaUnit', value as UnitDraft['areaUnit'])}
        />
      </Row>
      <NativePropertyMedia
        onlyPhotos
        photoLabel={`Unit ${number} photos`}
        photos={unit.photoUrls ?? []}
        disabled={locked}
        onUploading={onUploading}
        onAdd={(_kind, url) => onChange((row) => ({ ...row, photoUrls: [...(row.photoUrls ?? []), url] }))}
        onRemove={(_kind, photo) => onChange((row) => ({ ...row, photoUrls: row.photoUrls?.filter((_, i) => i !== photo) }))}
      />
      <Button title="Remove unit" variant="ghost" size="sm" disabled={locked || uploading} onPress={onRemove} />
    </NativeCard>
  );
}
