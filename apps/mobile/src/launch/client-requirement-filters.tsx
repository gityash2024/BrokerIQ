import { View } from 'react-native';
import { clientBedroomChoices, type ClientRequirementFilterDraft } from '@brokeriq/shared';
import { ChoiceField } from './form';
import { Input } from '@/ui';

export function NativeClientRequirementFilterFields({
  value,
  onChange,
}: {
  value: ClientRequirementFilterDraft;
  onChange: (filters: ClientRequirementFilterDraft) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <ChoiceField
        label="BHK"
        value={value.bedrooms}
        choices={[...clientBedroomChoices]}
        labels={Object.fromEntries(clientBedroomChoices.map((rooms) => [rooms, `${rooms} BHK`]))}
        onChange={(bedrooms) => onChange({ ...value, bedrooms: bedrooms ?? '' })}
        emptyLabel="Any BHK"
      />
      <Input label="Minimum budget (₹)" value={value.minBudget} keyboardType="decimal-pad" onChangeText={(minBudget) => onChange({ ...value, minBudget })} />
      <Input label="Maximum budget (₹)" value={value.maxBudget} keyboardType="decimal-pad" onChangeText={(maxBudget) => onChange({ ...value, maxBudget })} />
    </View>
  );
}
