import { View } from 'react-native';
import { INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, INVENTORY_FILTER_LABELS } from '@brokeriq/shared';
import { Input } from '@/ui';
import { ChoiceField } from './form';
import { NativeAdvancedFilters } from './advanced-filters';

export function NativeInventoryFilterFields({
  filters,
  setFilters,
  sectors,
  canViewArchived,
  dates,
  setDates,
}: {
  filters: Record<string, string>;
  setFilters: (filters: Record<string, string>) => void;
  sectors: string[];
  canViewArchived: boolean;
  dates: { from: string; to: string };
  setDates: (dates: { from: string; to: string }) => void;
}) {
  const choices: Record<string, string[]> = {
    ...(canViewArchived ? { archived: ['exclude', 'only', 'include'] } : {}),
    status: ['DRAFT', 'ACTIVE', 'INACTIVE', 'RENTED'],
    sector: sectors,
    purpose: ['RENT', 'SALE'],
    category: ['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND'],
    propertyType: PROPERTY_TYPES,
    bhk: ['1', '2', '3', '4', '5', '6'],
    roomKinds: ['BHK', 'RK', 'STUDIO'],
    furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'],
    availability: ['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE'],
    sourceType: ['MANUAL', 'PDF_REGISTER', 'WHATSAPP', 'CHAT_EXPORT', 'IMAGE', 'TEXT', 'PORTAL'],
    areaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
  };

  return (
    <>
      {Object.entries(choices).map(([name, options]) => (
        <View key={name} style={{ marginBottom: 14 }}>
          <ChoiceField
            emptyLabel="Any"
            label={INVENTORY_FILTER_LABELS[name] ?? name}
            value={filters[name] || null}
            choices={[...options]}
            onChange={(value) => setFilters({ ...filters, [name]: value ?? '' })}
          />
        </View>
      ))}
      {['minBudget', 'maxBudget', 'minArea', 'maxArea'].map((name) => (
        <Input
          key={name}
          label={INVENTORY_FILTER_LABELS[name] ?? name}
          keyboardType="decimal-pad"
          value={filters[name] ?? ''}
          onChangeText={(value) => setFilters({ ...filters, [name]: value })}
          containerStyle={{ marginBottom: 12 }}
        />
      ))}
      <Input label="Record date from (YYYY-MM-DD)" value={dates.from} onChangeText={(from) => setDates({ ...dates, from })} />
      <Input label="Record date through (YYYY-MM-DD)" value={dates.to} onChangeText={(to) => setDates({ ...dates, to })} />
      <NativeAdvancedFilters filters={filters} onChange={setFilters} />
    </>
  );
}
