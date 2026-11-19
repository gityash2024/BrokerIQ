import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react-native';
import { normalizeIndianPhone } from '@brokeriq/shared';
import { captureAccountContext, errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Input, Sheet, Txt } from '@/ui';
import { queueSurveyPhone } from './drafts';

export function SurveyPhoneAction({ allowed, sector }: { allowed: boolean; sector?: string }) {
  const client = useQueryClient();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  async function save() {
    if (!allowed || saving.current) return;
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) {
      setError('Enter a valid Indian phone number');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await queueSurveyPhone(normalized, sector, captureAccountContext());
      setPhone('');
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
          if (!saving.current) setOpen(false);
        }}
        title="Add survey phone"
      >
        <Input
          label="Owner phone number"
          value={phone}
          keyboardType="phone-pad"
          maxLength={25}
          editable={!busy}
          onChangeText={(value) => {
            setPhone(value);
            setError('');
          }}
        />
        {!!error && <Txt color="danger">{error}</Txt>}
        <Button title="Save to Survey" loading={busy} onPress={() => void save()} />
      </Sheet>
    </>
  );
}
