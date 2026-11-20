import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { Phone } from 'lucide-react-native';
import {
  normalizeIndianPhone,
  normalizeInventoryDirections,
  surveyConfigurationChoices,
  surveyFurnishingChoices,
  type InventoryInput,
  type SurveyUnitsInput,
} from '@brokeriq/shared';
import { captureAccountContext, errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Input, Row, Sheet, Txt } from '@/ui';
import { ChoiceField } from './form';
import { queueSurveyPhone } from './drafts';
import { SurveyContactFields } from './survey-contact-fields';
import { SurveyLocationField } from './survey-location-field';

export function SurveyPhoneAction({ allowed, sector }: { allowed: boolean; sector?: string }) {
  const client = useQueryClient();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [houseNo, setHouseNo] = useState('');
  const [units, setUnits] = useState<SurveyUnitsInput['units']>([{}]);
  function updateUnit(index: number, value: Partial<SurveyUnitsInput['units'][number]>) {
    setUnits((rows) => rows.map((row, i) => (i === index ? { ...row, ...value } : row)));
  }

  const [contacts, setContacts] = useState<NonNullable<InventoryInput['contacts']>>([]);
  const [error, setError] = useState('');
  const [directions, setDirections] = useState('');
  const [readingLocation, setReadingLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  async function save() {
    if (!allowed || saving.current || readingLocation) return;
    const filled = contacts.filter((contact) => contact.name?.trim() || contact.phone?.trim());
    if (!filled.length || filled.some((contact) => !normalizeIndianPhone(contact.phone))) {
      setError('Enter a valid Indian phone number for each contact');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await queueSurveyPhone(
        {
          houseNo,
          units,
          contacts: filled.map(({ name, phone }) => ({ name, phone: normalizeIndianPhone(phone)!, role: 'OWNER' })),
          sector,
          directionsUrl: normalizeInventoryDirections(directions) ?? undefined,
        },
        captureAccountContext(),
      );
      setHouseNo('');
      setUnits([{}]);
      setDirections('');
      setContacts([]);
      setOpen(false);
      toast.success('Survey phone saved on this device. It will sync automatically.');
      void client.invalidateQueries({ queryKey: ['local-drafts'] });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  return (
    <>
      <Button
        title="Add survey phone"
        disabled={!allowed}
        variant="secondary"
        icon={<Phone size={17} color={c.brand} />}
        style={{ flexGrow: 1, flexBasis: 140, minHeight: 44, borderRadius: 16, paddingHorizontal: 10 }}
        onPress={() => setOpen(true)}
      />
      <Sheet
        open={open}
        onClose={() => {
          if (!saving.current) {
            setReadingLocation(false);
            setOpen(false);
          }
        }}
        title="Add survey phone"
      >
        <Input label="House / plot no." value={houseNo} editable={!busy} onChangeText={setHouseNo} />
        {units.map((unit, index) => (
          <View key={index} style={{ gap: 6 }}>
            <Txt v="bodyStrong">Unit {index + 1}</Txt>
            <Row align="flex-start" gap={8}>
              <ChoiceField
                paired
                label="Configuration"
                value={unit.configuration}
                choices={[...surveyConfigurationChoices]}
                onChange={(value) => updateUnit(index, { configuration: (value ?? undefined) as typeof unit.configuration })}
              />
              <ChoiceField
                paired
                label="Furnishing"
                value={unit.furnishing}
                choices={[...surveyFurnishingChoices]}
                onChange={(value) => updateUnit(index, { furnishing: (value ?? undefined) as typeof unit.furnishing })}
              />
            </Row>
            {units.length > 1 && (
              <Row align="flex-start" gap={8}>
                <Input
                  label="Floor / unit reference"
                  value={unit.floor ?? ''}
                  editable={!busy}
                  onChangeText={(floor) => updateUnit(index, { floor })}
                  containerStyle={{ flex: 1 }}
                />
                <Button title="Remove unit" size="sm" variant="ghost" disabled={busy} onPress={() => setUnits(units.filter((_, i) => i !== index))} />
              </Row>
            )}
          </View>
        ))}
        <Button title="+ Add unit" size="sm" variant="secondary" disabled={busy || units.length >= 20} onPress={() => setUnits([...units, {}])} />
        <SurveyContactFields
          contacts={contacts}
          onlyOwner
          disabled={busy}
          onChange={(rows) => {
            setContacts(rows);
            setError('');
          }}
        />
        {open && <SurveyLocationField value={directions} onChange={setDirections} disabled={busy} onReading={setReadingLocation} />}
        {!!error && <Txt color="danger">{error}</Txt>}
        <Button title="Save to Survey" disabled={readingLocation} loading={busy} onPress={() => void save()} />
      </Sheet>
    </>
  );
}
