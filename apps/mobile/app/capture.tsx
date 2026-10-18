import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { Camera, ClipboardPaste, FileArchive, Images, ScanLine, ShieldCheck } from 'lucide-react-native';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { captureText, captureFile, editableDraft, decodeDraft, saveDraft, syncDrafts } from '@/launch/drafts';
import { Input, Txt, Button, Segmented, Row } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';

type Source = { uri: string; mime: string; name: string };
export default function Capture({ scanner = false }: { scanner?: boolean }) {
  const { target: requested } = useLocalSearchParams<{ target?: string }>();
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const [target, setTarget] = useState(['INVENTORY', 'REQUIREMENT'].includes(requested ?? '') ? requested! : 'AUTO');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const draftId = useRef<string | undefined>(undefined);
  const writes = useRef(Promise.resolve());
  const pendingFiles = useRef<Source[]>([]);
  useEffect(() => {
    let live = true;
    void editableDraft('CAPTURE_COMPOSE', 'message-composer')
      .then((row) => {
        if (!live) return;
        if (row) {
          const saved = decodeDraft(row);
          draftId.current = row.id;
          setText(saved.text ?? '');
          setGroup(saved.group ?? '');
          if (!requested || saved.entryTarget === requested) setTarget(saved.target ?? 'AUTO');
          setStatus('Draft restored');
        }
        setReady(true);
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || (!text && !group)) return;
    writes.current = writes.current
      .catch(() => undefined)
      .then(async () => {
        draftId.current = await saveDraft('CAPTURE_COMPOSE', 'message-composer', { text, group, target, entryTarget: requested }, draftId.current);
        setStatus('Draft saved on this device');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [text, group, target, ready]);
  async function preserve(files: Source[]) {
    pendingFiles.current = files;
    for (const file of files) {
      await captureFile(file.uri, file.mime, file.name, group || undefined, target);
      pendingFiles.current = pendingFiles.current.filter((p) => p !== file);
      setSources((current) => [...current, file.name]);
    }
    setStatus('Sources saved on this device. Open review after sync.');
    void syncDrafts().catch(() => undefined);
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function scan() {
    let uris: string[] = [];
    try {
      const result = await DocumentScanner.scanDocument({ maxNumDocuments: 20, croppedImageQuality: 90 });
      if (result.status === 'cancel') return;
      uris = result.scannedImages ?? [];
    } catch {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Camera permission is required to scan. Gallery and file import remain available.');
      const result = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (!result.canceled) uris = result.assets.map((a) => a.uri);
    }
    await preserve(uris.map((uri, i) => ({ uri, mime: 'image/jpeg', name: `scan-${Date.now()}-${i + 1}.jpg` })));
  }
  async function gallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 1 });
    if (!result.canceled)
      await preserve(result.assets.map((a, i) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? `image-${i + 1}.jpg` })));
  }
  async function files() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/zip'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled)
      await preserve(
        result.assets.slice(0, 20).map((a) => ({ uri: a.uri, mime: a.mimeType ?? (/\.zip$/i.test(a.name) ? 'application/zip' : 'text/plain'), name: a.name })),
      );
  }
  return (
    <BrokerScreen title={scanner ? 'Scanner & import' : 'Capture workspace'} subtitle="Inventory, requirements and original sources." back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 40 }}>
          <WorkspaceHero
            label="CAPTURE → REVIEW → SAVE"
            title="Every source. One clear workflow."
            description="Scan a register, paste a message or import a WhatsApp chat export. Review every extracted property or requirement."
          />
          <NativeCard>
            <Txt v="title">What are you adding?</Txt>
            <Segmented
              value={target}
              onChange={setTarget}
              options={[
                { label: 'Auto detect', value: 'AUTO' },
                { label: 'Inventory', value: 'INVENTORY' },
                { label: 'Requirements', value: 'REQUIREMENT' },
              ]}
            />
            <Txt v="caption" color="muted">
              This guides review. Mixed messages stay separate; nothing is added before approval.
            </Txt>
            <Input label="Group / source name (optional)" value={group} onChangeText={setGroup} editable={ready && !busy} />
          </NativeCard>
          <NativeCard>
            <Row>
              <ScanLine size={21} color={c.brand} />
              <Txt v="h3">Scan & upload</Txt>
            </Row>
            <Button title="Scan pages" icon={<Camera size={18} color="white" />} loading={busy} disabled={!ready} onPress={() => perform(scan)} />
            <Button
              title="Gallery · Multiple images"
              variant="secondary"
              icon={<Images size={18} color={c.brand} />}
              disabled={busy || !ready}
              onPress={() => perform(gallery)}
            />
            <Button
              title="WhatsApp export · TXT / ZIP / Images"
              variant="secondary"
              icon={<FileArchive size={18} color={c.brand} />}
              disabled={busy || !ready}
              onPress={() => perform(files)}
            />
            <Txt v="caption" color="muted">
              Up to 20 files per selection, 12MB each. Scanner supports multi-page crop and page cleanup. Originals stay private.
            </Txt>
            {!!sources.length && <WorkspaceTag tone="success" label={`${sources.length} sources saved on this device`} />}
            {sources.map((name, index) => (
              <Txt key={index} v="caption" color="muted">
                {name}
              </Txt>
            ))}
          </NativeCard>
          <NativeCard>
            <Row>
              <ClipboardPaste size={21} color={c.brand} />
              <Txt v="h3">Paste & fill</Txt>
            </Row>
            <Button
              title="Paste clipboard"
              variant="ghost"
              disabled={!ready || busy}
              onPress={() => perform(async () => setText(await Clipboard.getStringAsync()))}
            />
            <Input
              label="Original message"
              value={text}
              onChangeText={setText}
              editable={ready && !busy}
              multiline
              numberOfLines={7}
              style={{ minHeight: 170 }}
            />
            <Button
              title="Save message for review"
              loading={busy}
              disabled={!ready || !text.trim()}
              onPress={() =>
                perform(async () => {
                  await writes.current;
                  await captureText(text, 'WHATSAPP', group || undefined, target);
                  void syncDrafts().catch(() => undefined);
                  setStatus('Message saved. Open saved sources to review.');
                })
              }
            />
          </NativeCard>
          {!!error && (
            <NativeCard>
              <Txt color="danger">{error}</Txt>
              {!!pendingFiles.current.length && (
                <Button title="Retry remaining files" variant="secondary" onPress={() => perform(() => preserve(pendingFiles.current))} />
              )}
            </NativeCard>
          )}
          {!!status && (
            <Txt v="caption" color="muted">
              {status}
            </Txt>
          )}
          <Button title="Public rental draft scanner" variant="ghost" onPress={() => router.push('/listing-scanner' as any)} />
          <Button title="Saved sources & sync" variant="secondary" onPress={() => router.push('/drafts')} />
          <Row style={{ alignItems: 'flex-start' }}>
            <ShieldCheck size={18} color={c.brand} />
            <Txt v="caption" color="muted" style={{ flex: 1 }}>
              Encrypted drafts remain on this device while offline. WhatsApp: open chat → More → Export chat → share TXT/ZIP to BrokerIQ, or import the export
              here.
            </Txt>
          </Row>
        </ScrollView>
      </KeyboardAvoidingView>
    </BrokerScreen>
  );
}
