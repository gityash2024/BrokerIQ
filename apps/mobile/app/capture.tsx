import { surveySectors } from '@brokeriq/shared';
import { NativeInventoryFolderControls, useInventoryFolderDefinitions } from '@/launch/inventory-folder-controls';
import { LegacyDraftRecovery } from '@/launch/legacy-draft-recovery';
import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from '@/lib/image-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { Camera, ClipboardPaste, FileArchive, Images, ScanLine, ShieldCheck } from 'lucide-react-native';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { captureText, captureFile, editableDraft, decodeDraft, saveDraft, syncDrafts } from '@/launch/drafts';
import { Input, Txt, Button, Segmented, Row } from '@/ui';
import { captureAccountContext, errorMessage, authStore } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useConfig } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { useQuery } from '@tanstack/react-query';
import { ChoiceField } from '@/launch/form';
import { api } from '@/lib/api';
import { inventoryMonth, inventoryMonthSchema } from '@brokeriq/shared';

type Source = { uri: string; mime: string; name: string };
export default function Capture({ scanner = false }: { scanner?: boolean }) {
  const {
    target: requested,
    directoryMonth: requestedMonth,
    sector: requestedSector,
    customFolderId: requestedFolder,
  } = useLocalSearchParams<{ target?: string; directoryMonth?: string; sector?: string; customFolderId?: string }>();
  const survey = scanner && requested === 'SURVEY';
  const surveySector = survey ? requestedSector?.trim() || null : null;
  const composeKey = survey ? 'survey-composer:' + (surveySector ?? '') + (requestedFolder ? ':' + requestedFolder : '') : 'message-composer';
  const suggestedMonth = inventoryMonthSchema.safeParse(requestedMonth);
  const [directoryMonth, setDirectoryMonth] = useState(suggestedMonth.success ? suggestedMonth.data : inventoryMonth());
  const { c } = useTheme();
  const cutover = useConfig().flags.connect_whatsapp_cutover === true;
  const { user } = useAuth();
  const [registerSector, setRegisterSector] = useState<string | null>(surveySector);
  const [registerFolderId, setRegisterFolderId] = useState<string | null>(requestedFolder ?? null);
  const folderDefinitions = useInventoryFolderDefinitions(scanner);
  const customFolders = (folderDefinitions.data ?? []).filter(({ kind }) => kind === 'CUSTOM');
  const savedSectors = (folderDefinitions.data ?? []).filter(({ kind }) => kind === 'SECTOR').map(({ label }) => label);
  const localities = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<{ name: string }[]>('/public/localities', { auth: false }),
    enabled: scanner,
    staleTime: 600_000,
  });
  const [registerSessionId, setRegisterSessionId] = useState(Crypto.randomUUID);
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const [target, setTarget] = useState(survey ? 'SURVEY' : ['INVENTORY', 'REQUIREMENT'].includes(requested ?? '') ? requested! : 'AUTO');
  const captureMonth = target === 'INVENTORY' ? directoryMonth : undefined;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [startSeparate, setStartSeparate] = useState(false);
  const [status, setStatus] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const owner = useRef(captureAccountContext());
  const draftId = useRef<string | undefined>(undefined);
  const writes = useRef(Promise.resolve());
  const pendingFiles = useRef<Source[]>([]);
  useEffect(() => {
    let live = true;
    void editableDraft('CAPTURE_COMPOSE', composeKey, owner.current, startSeparate)
      .then((row) => {
        if (!live) return;
        if (row) {
          const saved = decodeDraft(row);
          draftId.current = row.id;
          setText(saved.text ?? '');
          setGroup(saved.group ?? '');
          setRegisterSector(saved.registerSector ?? surveySector);
          setRegisterFolderId(saved.registerFolderId ?? requestedFolder ?? null);
          if (saved.registerSessionId) setRegisterSessionId(saved.registerSessionId);
          if (!survey && (!requested || saved.entryTarget === requested)) setTarget(saved.target ?? 'AUTO');
          if (!suggestedMonth.success && saved.directoryMonth) setDirectoryMonth(saved.directoryMonth);
          setStatus('Draft restored');
        }
        setReady(true);
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [startSeparate, composeKey]);
  useEffect(() => {
    if (!ready || (!scanner && !text && !group && !draftId.current)) return;
    writes.current = writes.current
      .catch(() => undefined)
      .then(async () => {
        draftId.current = await saveDraft(
          'CAPTURE_COMPOSE',
          composeKey,
          { text, group, target, directoryMonth, entryTarget: requested, registerSessionId, registerSector, registerFolderId },
          draftId.current,
          owner.current,
        );
        setStatus('Draft saved on this device');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [text, group, target, directoryMonth, ready, registerSessionId, registerSector, registerFolderId]);
  async function preserve(files: Source[]) {
    await writes.current;
    pendingFiles.current = files;
    for (const file of files) {
      await captureFile(
        file.uri,
        file.mime,
        file.name,
        group || undefined,
        target,
        owner.current,
        captureMonth,
        scanner ? registerSessionId : undefined,
        scanner ? (registerSector ?? undefined) : undefined,
        scanner ? (registerFolderId ?? undefined) : undefined,
      );
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
      if (target === 'INVENTORY' && !inventoryMonthSchema.safeParse(captureMonth).success) throw new Error('Choose the inventory year and month.');
      if (survey && !registerSector) throw new Error('Choose the sector before scanning the survey register.');
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
      await camera();
      return;
    }
    await preserve(uris.map((uri, i) => ({ uri, mime: 'image/jpeg', name: `scan-${Date.now()}-${i + 1}.jpg` })));
  }
  async function camera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission is required to scan. Gallery and file import remain available.');
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled)
      await preserve(
        result.assets.map((asset, index) => ({ uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg', name: `camera-${Date.now()}-${index + 1}.jpg` })),
      );
  }
  async function gallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 0, quality: 1 });
    if (!result.canceled)
      await preserve(result.assets.map((a, i) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? `image-${i + 1}.jpg` })));
  }
  async function files() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled)
      await preserve(result.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? (/\.zip$/i.test(a.name) ? 'application/zip' : 'text/plain'), name: a.name })));
  }
  return (
    <BrokerScreen
      title={survey ? 'Scan survey register' : scanner ? 'Scanner & import' : 'Capture workspace'}
      subtitle={survey ? 'Choose the sector, scan the pages and review the extracted properties.' : 'Inventory, requirements and original sources.'}
      back
    >
      <View style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 40 }}>
          <WorkspaceHero
            label="CAPTURE → REVIEW → SAVE"
            title="Every source. One clear workflow."
            description={cutover ? "Scan a register or paste a message. Review every extracted property or requirement." : "Scan a register, paste a message or import a WhatsApp chat export. Review every extracted property or requirement."}
          />
          {scanner && (
            <NativeCard>
              <Txt color="muted">Pages in this register keep the preceding sector until a new sector heading is found.</Txt>
              <ChoiceField
                access={ready && !busy}
                label="Register sector"
                value={registerSector}
                choices={surveySectors([...(registerSector ? [registerSector] : []), ...savedSectors, ...(localities.data ?? []).map((locality) => locality.name)])}
                emptyLabel={survey ? 'Choose sector first' : 'Read from page heading'}
                onChange={(value) => {
                  setRegisterSector(value);
                  setRegisterSessionId(Crypto.randomUUID());
                  setSources([]);
                }}
              />
              <ChoiceField access={ready && !busy} label="Save in custom folder" value={registerFolderId}
                choices={customFolders.map(({ id }) => id)} labels={Object.fromEntries(customFolders.map(({ id, label }) => [id, label]))}
                emptyLabel="No custom folder" onChange={(folderId) => {
                  setRegisterFolderId(folderId);
                  setRegisterSessionId(Crypto.randomUUID());
                  setSources([]);
                }} />
              <NativeInventoryFolderControls onCreated={(folder) => {
                if (folder.kind === 'SECTOR') setRegisterSector(folder.label);
                else setRegisterFolderId(folder.id);
                setRegisterSessionId(Crypto.randomUUID());
                setSources([]);
              }} />
              {localities.error && <Button title="Retry sectors" variant="secondary" onPress={() => localities.refetch()} />}

              <Button
                title="Start a new register"
                variant="secondary"
                disabled={busy || !ready}
                onPress={() => {
                  setRegisterSessionId(Crypto.randomUUID());
                  setRegisterSector(null);
                  setSources([]);
                  setStatus(survey ? 'New register started. Choose its sector.' : 'New register started. The first page sets its sector.');
                }}
              />
            </NativeCard>
          )}
          {!survey && (
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
              {target === 'INVENTORY' && (
                <Input
                  label="Inventory year and month (YYYY-MM)"
                  value={directoryMonth}
                  onChangeText={setDirectoryMonth}
                  maxLength={7}
                  editable={ready && !busy}
                />
              )}
              <Input label="Group / source name (optional)" value={group} onChangeText={setGroup} editable={ready && !busy} />
            </NativeCard>
          )}
          <NativeCard>
            <Row>
              <ScanLine size={21} color={c.brand} />
              <Txt v="h3">Scan & upload</Txt>
            </Row>
            <Button
              title="Scan pages"
              icon={<Camera size={18} color="white" />}
              loading={busy}
              disabled={!ready || (survey && !registerSector)}
              onPress={() => perform(scan)}
            />
            <Button
              title="Camera photo · Alternative scan"
              variant="secondary"
              icon={<Camera size={18} color={c.brand} />}
              disabled={busy || !ready || (survey && !registerSector)}
              onPress={() => perform(camera)}
            />
            <Button
              title="Gallery · Multiple images"
              variant="secondary"
              icon={<Images size={18} color={c.brand} />}
              disabled={busy || !ready || (survey && !registerSector)}
              onPress={() => perform(gallery)}
            />
            {!survey && !cutover && (
              <Button
                title="WhatsApp export · TXT / ZIP / Images"
                variant="secondary"
                icon={<FileArchive size={18} color={c.brand} />}
                disabled={busy || !ready}
                onPress={() => perform(files)}
              />
            )}
            {!survey && cutover && hasDelegatedAccess(user, 'inventory', 'view') && (
              <Button title="Import properties from PDF" variant="secondary" onPress={() => router.push('/pdf-inventory' as never)} />
            )}
            <Txt v="caption" color="muted">
              Up to 300 MB per source, uploaded in resumable encrypted chunks. No file-selection count limit. Scanner supports multi-page crop and page cleanup.
              Originals stay private.
            </Txt>
            {!!sources.length && <WorkspaceTag tone="success" label={`${sources.length} sources saved on this device`} />}
            {sources.map((name, index) => (
              <Txt key={index} v="caption" color="muted">
                {name}
              </Txt>
            ))}
          </NativeCard>
          {!survey && (
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
                    await captureText(text, 'WHATSAPP', group || undefined, target, owner.current, captureMonth);
                    void syncDrafts().catch(() => undefined);
                    setStatus('Message saved. Open saved sources to review.');
                  })
                }
              />
            </NativeCard>
          )}
          <LegacyDraftRecovery
            error={error}
            onStart={() => {
              setError('');
              setStartSeparate(true);
            }}
          />
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
      </View>
    </BrokerScreen>
  );
}
