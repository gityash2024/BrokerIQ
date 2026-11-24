import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { Phone } from 'lucide-react-native';
import {
  normalizeIndianPhone,
  normalizeInventoryDirections,
  surveyConfigurationChoices,
  surveyFurnishingChoices,
  inventoryUnitLimit,
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
import { SurveyPropertyMatches } from './survey-property-matches';
import { NativePropertyMedia } from './property-media';

export function SurveyPhoneAction({ allowed, sector, customFolderId }: { allowed: boolean; sector?: string; customFolderId?: string }) {
  const client = useQueryClient();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [houseNo, setHouseNo] = useState('');
  const [manualSector, setManualSector] = useState('');
  const selectedSector = sector ?? (manualSector.trim() || undefined);
  const [units, setUnits] = useState<SurveyUnitsInput['units']>([{}]);
  function updateUnit(index: number, value: Partial<SurveyUnitsInput['units'][number]>) {
    setUnits((rows) => rows.map((row, i) => (i === index ? { ...row, ...value } : row)));
  }

  const [contacts, setContacts] = useState<NonNullable<InventoryInput['contacts']>>([]);
  const [error, setError] = useState('');
  const [directions, setDirections] = useState('');
  const [readingLocation, setReadingLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const saving = useRef(false);

  async function save() {
    if (!allowed || saving.current || readingLocation || uploading !== null) return;
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
          sector: selectedSector,
          customFolderId,
          directionsUrl: normalizeInventoryDirections(directions) ?? undefined,
        },
        captureAccountContext(),
      );
      setHouseNo('');
      setManualSector('');
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
          if (!saving.current && uploading === null) {
            setReadingLocation(false);
            setOpen(false);
          }
        }}
        title="Add survey phone"
      >
        {!sector && <Input label="Sector / locality" value={manualSector} maxLength={200} editable={!busy} onChangeText={setManualSector} />}
        <Input label="House / plot no." value={houseNo} editable={!busy} onChangeText={setHouseNo} />
        {open && <SurveyPropertyMatches sector={selectedSector} houseNo={houseNo} />}
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
                  label="Floor"
                  value={unit.floor ?? ''}
                  editable={!busy}
                  onChangeText={(floor) => updateUnit(index, { floor })}
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Unit reference"
                  value={unit.unitLabel ?? ''}
                  editable={!busy}
                  onChangeText={(unitLabel) => updateUnit(index, { unitLabel })}
                  containerStyle={{ flex: 1 }}
                />
              </Row>
            )}
            {units.length > 1 && (
              <Button
                title="Remove unit"
                size="sm"
                variant="ghost"
                disabled={busy || uploading !== null}
                onPress={() => setUnits(units.filter((_, i) => i !== index))}
              />
            )}
            <NativePropertyMedia
              onlyPhotos
              camera
              photoLabel={`Unit ${index + 1} photos`}
              photos={unit.photoUrls ?? []}
              disabled={busy || (uploading !== null && uploading !== index)}
              onUploading={(active) => setUploading(active ? index : null)}
              onAdd={(_kind, url) => setUnits((rows) => rows.map((row, i) => (i === index ? { ...row, photoUrls: [...(row.photoUrls ?? []), url] } : row)))}
              onRemove={(_kind, photo) => updateUnit(index, { photoUrls: unit.photoUrls?.filter((_, i) => i !== photo) })}
            />
          </View>
        ))}
        <Button
          title="+ Add unit"
          size="sm"
          variant="secondary"
          disabled={busy || uploading !== null || units.length >= inventoryUnitLimit}
          onPress={() => setUnits([...units, {}])}
        />
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
        <Button title="Save to Survey" disabled={readingLocation || uploading !== null} loading={busy} onPress={() => void save()} />
      </Sheet>
    </>
  );
}
