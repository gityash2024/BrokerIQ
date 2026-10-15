import { View } from 'react-native';
import { INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, inventoryInputSchema, brokerRequirementSchema, preparePropertyDetails } from '@brokeriq/shared';
import { Input, Button, Txt } from '@/ui';
import { NativePropertyExtras } from './property-extras';
import { ChoiceField } from './form';
import { useTheme } from '@/lib/theme';
export function prepareEntity(value: Record<string, any>, requirement = false) {
  const input = { ...value };
  for (const key of requirement
    ? ['minBudget', 'maxBudget', 'minArea', 'maxArea']
    : ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'])
    input[key] = input[key] === '' || input[key] == null ? null : Number(input[key]);
  if (!requirement) input.details = preparePropertyDetails(input.details);
  const schema = requirement ? brokerRequirementSchema : inventoryInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}
export function EntityFields({
  value,
  onChange,
  requirement = false,
}: {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  requirement?: boolean;
}) {
  const { c } = useTheme();
  const change = (name: string, v: any) =>
    onChange({ ...value, ...(name === 'purpose' && v === 'SALE' && !requirement ? { rent: null, monthlyRent: null } : {}), [name]: v });
  const numeric = ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit', 'minBudget', 'maxBudget', 'minArea', 'maxArea'];
  const field = (name: string, label: string, multiline = false) => (
    <Input
      key={name}
      label={label}
      value={value[name] == null ? '' : String(value[name])}
      onChangeText={(v) => change(name, v)}
      keyboardType={numeric.includes(name) ? 'decimal-pad' : 'default'}
      multiline={multiline}
      style={multiline ? { minHeight: 90 } : undefined}
    />
  );
  const choice = (key: string, label: string, options: string[]) => (
    <ChoiceField label={label} value={value[key]} choices={options} onChange={(v) => change(key, v)} />
  );
  return (
    <View style={{ gap: 14 }}>
      {requirement ? (
        <>
          <Txt v="h3">Contact & requirement</Txt>
          {field('contactName', 'Contact name')}
          {field('contactPhone', 'Phone')}
          <Input
            label="Preferred localities (comma separated)"
            value={(value.localityNames ?? []).join(', ')}
            onChangeText={(v) =>
              change(
                'localityNames',
                v
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </>
      ) : (
        <>
          <Txt v="h3">Location</Txt>
          {field('sector', 'Sector / locality')}
          {field('houseNo', 'House / plot no.')}
          {field('unitLabel', 'Unit')}
          {field('floor', 'Floor')}
          {field('address', 'Address')}
        </>
      )}
      {choice('purpose', 'Purpose', ['RENT', 'SALE'])}
      {choice('category', 'Category', ['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND'])}
      {requirement ? (
        <>
          <ChoiceField
            label="Property type"
            value={value.propertyTypes?.[0]}
            choices={PROPERTY_TYPES}
            onChange={(v) => change('propertyTypes', v ? [v] : [])}
          />
          <Input
            label="Rooms (comma separated)"
            keyboardType="numbers-and-punctuation"
            value={(value.bedrooms ?? []).join(',')}
            onChangeText={(v) =>
              change(
                'bedrooms',
                v
                  .split(',')
                  .map((s) => Number(s.trim()))
                  .filter((n) => n > 0),
              )
            }
          />
        </>
      ) : (
        <>
          {choice('propertyType', 'Property type', PROPERTY_TYPES)}
          {field('bhk', 'Rooms')}
        </>
      )}
      {choice('roomKind', 'Room kind', ['BHK', 'RK', 'STUDIO'])}
      {choice('furnishing', 'Furnishing', ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'])}
      <Txt v="h3">Price & area</Txt>
      {requirement ? (
        <>
          {field('minBudget', 'Minimum budget ₹')}
          {field('maxBudget', 'Maximum budget ₹')}
          {field('minArea', 'Minimum area')}
          {field('maxArea', 'Maximum area')}
        </>
      ) : (
        <>
          {value.purpose === 'RENT' ? (
            field('monthlyRent', 'Monthly rent ₹')
          ) : (
            <>
              {field('totalSalePrice', 'Total sale price ₹')}
              {field('ratePerArea', 'Rate per area ₹')}
              {choice('rateAreaUnit', 'Rate unit', ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'])}
            </>
          )}
          {field('area', 'Area')}
        </>
      )}
      {choice('areaUnit', 'Area unit', ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'])}
      {!requirement && (
        <>
          {choice('availability', 'Availability', ['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE'])}
          <Txt v="h3">Contacts</Txt>
          {(value.contacts ?? []).map((contact: any, i: number) => (
            <View key={i} style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: c.line, borderRadius: 12 }}>
              <Input
                label="Contact name"
                value={contact.name ?? ''}
                onChangeText={(name) =>
                  change(
                    'contacts',
                    value.contacts.map((item: any, n: number) => (n === i ? { ...item, name } : item)),
                  )
                }
              />
              <Input
                label="Phone"
                keyboardType="phone-pad"
                value={contact.phone ?? ''}
                onChangeText={(phone) =>
                  change(
                    'contacts',
                    value.contacts.map((item: any, n: number) => (n === i ? { ...item, phone } : item)),
                  )
                }
              />
              <ChoiceField
                label="Contact role"
                value={contact.role}
                choices={['UNKNOWN', 'OWNER', 'BROKER']}
                onChange={(role) =>
                  change(
                    'contacts',
                    value.contacts.map((item: any, n: number) => (n === i ? { ...item, role: role ?? 'UNKNOWN' } : item)),
                  )
                }
              />
              <Button
                title="Remove contact"
                size="sm"
                variant="ghost"
                onPress={() =>
                  change(
                    'contacts',
                    value.contacts.filter((_: any, n: number) => n !== i),
                  )
                }
              />
            </View>
          ))}
          <Button title="Add contact" variant="secondary" onPress={() => change('contacts', [...(value.contacts ?? []), { role: 'UNKNOWN' }])} />
        </>
      )}
      {!requirement && <NativePropertyExtras value={value} onChange={onChange} />}
      {field('notes', 'Notes', true)}
    </View>
  );
}
