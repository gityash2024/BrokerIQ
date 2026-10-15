import { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { PROPERTY_AMENITIES, INVENTORY_SORTS, visiblePropertyFields } from '@brokeriq/shared';
import { Input, Txt, Chip } from '@/ui';
import { ChoiceField } from './form';
import { useTheme } from '@/lib/theme';
export function NativeAdvancedFilters({ filters, onChange }: { filters: Record<string, string>; onChange: (value: any) => void }) {
  const { c } = useTheme();
  const [group, setGroup] = useState('Location');
  const fields = visiblePropertyFields(filters.category);
  const groups = ['Sort & source', ...new Set(fields.map((f) => f.group)), 'Amenities & media'];
  let details: Record<string, any> = {};
  try {
    details = JSON.parse(filters.detailFilters || '{}');
  } catch {}
  function set(key: string, value: any) {
    const next = { ...details };
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) delete next[key];
    else next[key] = value;
    onChange({ ...filters, detailFilters: Object.keys(next).length ? JSON.stringify(next) : '' });
  }
  return (
    <View style={{ gap: 14, marginTop: 16 }}>
      <Txt v="h3">More filters</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {groups.map((name) => (
          <Pressable
            key={name}
            onPress={() => setGroup(name)}
            style={{ padding: 10, borderRadius: 8, backgroundColor: group === name ? c.brandSoft : c.surface2 }}
          >
            <Txt v="caption" color={group === name ? 'brand' : 'muted'}>
              {name}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
      {group === 'Sort & source' ? (
        <>
          <ChoiceField
            label="Sort by"
            value={INVENTORY_SORTS.find((s) => s.value === filters.sort)?.label ?? null}
            choices={INVENTORY_SORTS.map((s) => s.label)}
            onChange={(label) => onChange({ ...filters, sort: INVENTORY_SORTS.find((s) => s.label === label)?.value ?? '' })}
          />
          <ChoiceField
            label="Data verification"
            value={filters.verificationStatus}
            choices={['VERIFIED', 'NEEDS_REVIEW']}
            onChange={(v) => onChange({ ...filters, verificationStatus: v ?? '' })}
          />
          {[
            ['minRate', 'Minimum ₹ / sq.ft.'],
            ['maxRate', 'Maximum ₹ / sq.ft.'],
          ].map(([key, label]) => (
            <Input key={key} label={label} value={filters[key] ?? ''} keyboardType="decimal-pad" onChangeText={(v) => onChange({ ...filters, [key]: v })} />
          ))}
          <Input label="Floor" value={filters.floor ?? ''} onChangeText={(v) => onChange({ ...filters, floor: v })} />
        </>
      ) : group === 'Amenities & media' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {[
              ['hasPhotos', 'With photos'],
              ['hasVideos', 'With videos'],
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                active={filters[key] === 'true'}
                onPress={() => onChange({ ...filters, [key]: filters[key] === 'true' ? '' : 'true' })}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {PROPERTY_AMENITIES.map((a) => {
              const selected = (filters.amenities ?? '').split(',').filter(Boolean);
              return (
                <Chip
                  key={a}
                  label={a.replace(/_/g, ' ')}
                  active={selected.includes(a)}
                  onPress={() => onChange({ ...filters, amenities: (selected.includes(a) ? selected.filter((s) => s !== a) : [...selected, a]).join(',') })}
                />
              );
            })}
          </View>
        </>
      ) : (
        fields
          .filter((f) => f.group === group)
          .map((f) => (
            <View key={f.key} style={{ gap: 8 }}>
              <Txt v="caption">{f.label}</Txt>
              {f.kind === 'number' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['min', 'max'].map((bound) => (
                    <Input
                      key={bound}
                      label={bound === 'min' ? 'Minimum' : 'Maximum'}
                      keyboardType="decimal-pad"
                      containerStyle={{ flex: 1 }}
                      value={details[f.key]?.[bound] == null ? '' : String(details[f.key][bound])}
                      onChangeText={(v) => {
                        const range = { ...details[f.key] };
                        if (v === '') delete range[bound];
                        else range[bound] = Number(v);
                        set(f.key, Object.keys(range).length ? range : null);
                      }}
                    />
                  ))}
                </View>
              ) : f.options ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {f.options.map((v) => {
                    const selected = Array.isArray(details[f.key]) ? details[f.key] : [];
                    return (
                      <Chip
                        key={v}
                        label={v.replace(/_/g, ' ')}
                        active={selected.includes(v)}
                        onPress={() => set(f.key, selected.includes(v) ? selected.filter((s: string) => s !== v) : [...selected, v])}
                      />
                    );
                  })}
                </View>
              ) : f.kind === 'boolean' ? (
                <ChoiceField
                  label={f.label}
                  value={details[f.key] == null ? null : details[f.key] ? 'Yes' : 'No'}
                  choices={['Yes', 'No']}
                  onChange={(v) => set(f.key, v == null ? null : v === 'Yes')}
                />
              ) : (
                <Input
                  value={details[f.key] ?? ''}
                  onChangeText={(v) => set(f.key, v)}
                  placeholder={f.key.endsWith('Date') || f.key === 'availableFrom' ? 'YYYY-MM-DD' : f.label}
                />
              )}
            </View>
          ))
      )}
    </View>
  );
}
