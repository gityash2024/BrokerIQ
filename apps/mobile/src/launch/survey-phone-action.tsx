import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react-native';
import { normalizeIndianPhone, normalizeInventoryDirections, type InventoryInput } from '@brokeriq/shared';
import { captureAccountContext, errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Sheet, Txt } from '@/ui';
import { queueSurveyPhone } from './drafts';
import { SurveyContactFields } from './survey-contact-fields';
import { SurveyLocationField } from './survey-location-field';

export function SurveyPhoneAction({ allowed, sector }: { allowed: boolean; sector?: string }) {
  const client = useQueryClient();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
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
      await queueSurveyPhone({ contacts: filled, sector, directionsUrl: normalizeInventoryDirections(directions) ?? undefined }, captureAccountContext());
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
