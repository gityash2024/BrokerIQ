import { useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { BrokerScreen } from '@/launch/screen';
import { captureText, captureFile, syncDrafts } from '@/launch/drafts';
import { Input, Txt, Button } from '@/ui';
import { errorMessage } from '@/lib/api';
export default function Capture() {
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(file = false) {
    setBusy(true);
    setError('');
    try {
      if (file) {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/zip'],
          copyToCacheDirectory: true,
        });
        if (picked.canceled) return;
        const source = picked.assets[0];
        await captureFile(source.uri, source.mimeType ?? 'text/plain', source.name, group || undefined);
      } else {
        if (!text.trim()) throw new Error('Paste a message first');
        await captureText(text, 'WHATSAPP', group || undefined);
      }
      void syncDrafts().catch(() => undefined);
      router.replace('/drafts');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <BrokerScreen title="Capture to Inbox" back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <Txt color="muted">
            Share a message, screenshot or chat export from WhatsApp to BrokerIQ. Every extraction is reviewed before saving to your ledger.
          </Txt>
          <Button title="Choose image / chat export" variant="secondary" loading={busy} onPress={() => save(true)} />
          <Input label="Group / source name (optional)" value={group} onChangeText={setGroup} />
          <Button title="Paste clipboard" variant="ghost" onPress={async () => setText(await Clipboard.getStringAsync())} />
          <Input label="Message" value={text} onChangeText={setText} multiline numberOfLines={10} style={{ minHeight: 200 }} />
          {error && <Txt color="danger">{error}</Txt>}
          <Button title="Save capture" loading={busy} disabled={!text.trim()} onPress={() => save()} />
          <Txt v="caption" color="muted">
            Files up to 12MB. Originals and unsynced content stay on this device.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </BrokerScreen>
  );
}
