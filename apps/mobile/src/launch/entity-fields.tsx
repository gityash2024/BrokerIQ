import { View } from 'react-native';
import {
  INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES,
  inventoryInputSchema,
  brokerRequirementSchema,
  preparePropertyDetails,
  offeredRequirement,
  type InventoryInput,
  type BrokerRequirementInput,
} from '@brokeriq/shared';
import { Input, Button, Txt } from '@/ui';
import { NativePropertyExtras } from './property-extras';
import { PropertyDateField } from './property-date-field';
import { ChoiceField } from './form';
import { useTheme } from '@/lib/theme';
export function prepareEntity(value: Record<string, any>, requirement = false): InventoryInput | BrokerRequirementInput {
  if (requirement && value.intent === 'OFFER')
    return brokerRequirementSchema.parse({
      ...offeredRequirement(inventoryInputSchema.parse(prepareEntity(value.offerDetails || {}))),
      leadId: value.leadId,
      expectedRevision: value.expectedRevision,
    });
  if (requirement && value.intent === 'UNKNOWN')
    return brokerRequirementSchema.parse({ intent: 'UNKNOWN', title: value.title, notes: value.notes, expectedRevision: value.expectedRevision });
  const input = { ...value };
  for (const key of requirement ? ['minBudget', 'maxBudget', 'minArea', 'maxArea'] : ['bhk', 'area', 'totalSalePrice', 'ratePerArea', 'securityDeposit'])
    input[key] = input[key] === '' || input[key] == null ? null : Number(input[key]);
  if (!requirement) {
    input.details = preparePropertyDetails(input.details);
    const monthly = input.monthlyRent ?? (input.purpose === 'RENT' ? input.rent : null);
    input.monthlyRent = monthly === '' || monthly == null ? null : Number(monthly);
    delete input.rent;
  }
  const schema = requirement ? brokerRequirementSchema : inventoryInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}
export function EntityFields({
  value,
  onChange,
  requirement = false,
  folderMonth,
  survey = false,
}: {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  requirement?: boolean;
  folderMonth?: string;
  survey?: boolean;
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
  const intent = choice('intent', 'Record type', ['DEMAND', 'OFFER', 'UNKNOWN']);
  const detail = (key: string, fieldValue: unknown) => change('details', { ...value.details, [key]: fieldValue });
  if (survey && !requirement)
    return (
      <View style={{ gap: 14 }}>
        <PropertyDateField label="Possession date" value={value.details?.possessionDate} onChange={(date) => detail('possessionDate', date)} />
        {field('houseNo', 'House / plot no.')}
        {field('sector', 'Sector / locality')}
        <Input
          label="Phone number"
          keyboardType="phone-pad"
          value={value.contacts?.[0]?.phone ?? value.ownerPhone ?? ''}
          onChangeText={(phone) => change('contacts', [{ ...(value.contacts?.[0] ?? { role: 'UNKNOWN' }), phone }, ...(value.contacts ?? []).slice(1)])}
        />
        {field('bhk', 'Number of bedrooms')}
        {choice('furnishing', 'Furnishing', ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'])}
        {field('floor', 'Floor')}
        <ChoiceField
          label="Food preference"
          value={value.details?.foodPreference}
          choices={['VEGETARIAN_ONLY', 'NO_RESTRICTION']}
          onChange={(food) => detail('foodPreference', food)}
        />
        <ChoiceField
          label="Pets allowed"
          value={value.details?.petFriendly == null ? null : String(value.details.petFriendly)}
          choices={['true', 'false']}
          labels={{ true: 'Allowed', false: 'Not allowed' }}
          onChange={(pets) => detail('petFriendly', pets == null ? null : pets === 'true')}
        />
        {choice('availability', 'Observed status', ['UNKNOWN', 'RENTED'])}
      </View>
    );
  if (requirement && value.intent === 'OFFER')
    return (
      <View style={{ gap: 14 }}>
        {intent}
        <EntityFields value={value.offerDetails || {}} onChange={(offerDetails) => change('offerDetails', offerDetails)} />
      </View>
    );
  if (requirement && value.intent === 'UNKNOWN')
    return (
      <View style={{ gap: 14 }}>
        {intent}
        {field('title', 'Title')}
        {field('notes', 'Original details / notes', true)}
      </View>
    );
  return (
    <View style={{ gap: 14 }}>
      {requirement && intent}
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
          <PropertyDateField label="Possession date" value={value.details?.possessionDate} onChange={(date) => detail('possessionDate', date)} />
          <Txt v="h3">Location</Txt>
          {field('houseNo', 'House / plot no.')}
          {field('sector', 'Sector / locality')}
          {field('unitLabel', 'Unit')}
          {field('floor', 'Floor')}
          {field('address', 'Address')}
          {folderMonth && (
            <>
              <Input
                label="Inventory year and month (YYYY-MM)"
                value={value.directoryMonth ?? folderMonth}
                maxLength={7}
                onChangeText={(month) => change('directoryMonth', month)}
              />
              <Input
                label="Directions link · Google Maps or Apple Maps"
                value={value.directionsUrl ?? ''}
                onChangeText={(url) => change('directionsUrl', url || null)}
              />
            </>
          )}
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
      {choice('roomKind', 'Property configuration', ['BHK', 'RK', 'STUDIO'])}
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
                value={contact.role ?? 'OWNER'}
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
          <Button title="Add contact" variant="secondary" onPress={() => change('contacts', [...(value.contacts ?? []), { role: 'OWNER' }])} />
        </>
      )}
      {!requirement && <NativePropertyExtras value={value} onChange={onChange} separatePossession />}
      {field('notes', 'Notes', true)}
    </View>
  );
}
