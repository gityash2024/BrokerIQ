import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bytesToBase64, hasDelegatedAccess, normalizeIndianPhone, PDF_INVENTORY_MAX_BYTES, pdfInventoryEditableFields, pdfInventoryFilterFields, uploadImport,
  type PdfInventoryBatch, type PdfInventoryRow } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api, captureAccountContext, errorMessage, qs } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button, ErrorView, Input, Loader, Row, Sheet, Txt } from '@/ui';
import { ChoiceField } from '@/launch/form';
import { BrokerScreen, NativeCard } from '@/launch/screen';

const endpoint = '/inventory-pdf';

export default function PdfInventoryScreen() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importsOpen, setImportsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [row, setRow] = useState<PdfInventoryRow | null>(null);
  const [busyBatch, setBusyBatch] = useState('');
  const allowed = !!user && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user.role) && hasDelegatedAccess(user, 'inventory', 'view');
  const canCreate = allowed && hasDelegatedAccess(user, 'inventory', 'create');
  const canEdit = allowed && hasDelegatedAccess(user, 'inventory', 'edit');
  const canDelete = allowed && hasDelegatedAccess(user, 'inventory', 'delete');
  const canReadContacts = allowed && hasDelegatedAccess(user, 'inventory', 'approve_details');
  const data = useQuery({
    queryKey: ['pdf-inventory', user?.organization?.id, user?.id, filters, page, canReadContacts],
    queryFn: () => api<{ items: PdfInventoryRow[]; batches: PdfInventoryBatch[]; total: number }>(endpoint + qs({ ...filters, page })),
    enabled: allowed,
    refetchInterval: (state) => state.state.data?.batches.some(({ status }) => status === 'PENDING' || status === 'PROCESSING') ? 3000 : false,
  });
  useEffect(() => { setFile(null); setRow(null); }, [user?.id, user?.organization?.id]);

  async function upload(selection: { uri: string; name: string }, ownerContext: ReturnType<typeof captureAccountContext>) {
    const source = new File(selection.uri);
    if (!source.exists || source.size === 0 || source.size > PDF_INVENTORY_MAX_BYTES) {
      toast.error('Select a PDF of up to 32 MB');
      return;
    }
    const hash = source.md5;
    if (!hash) return toast.error('Selected PDF cannot be read');
    setFile(selection);
    setProgress(0);
    try {
      const handle = source.open();
      try {
        await uploadImport((path, body) => api(path, { method: 'POST', body, ownerContext }), {
          clientKey: hash + '-' + selection.name.slice(0, 50), fileName: selection.name, contentType: 'application/pdf', sourceType: 'PDF', totalBytes: source.size,
        }, async (offset, length) => {
          handle.offset = offset;
          return bytesToBase64(handle.readBytes(length));
        }, (sent, total) => setProgress(Math.round(sent / total * 100)), endpoint + '/uploads');
      } finally { handle.close(); }
      setFile(null);
      toast.success('PDF received');
      await data.refetch();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setProgress(null); }
  }

  async function chooseFile() {
    const ownerContext = captureAccountContext();
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) await upload(result.assets[0], ownerContext);
    } catch (error) { toast.error(errorMessage(error)); }
  }

  async function retry(id: string) {
    setBusyBatch(id);
    try {
      await api(`${endpoint}/batches/${id}/retry`, { method: 'POST' });
      await data.refetch();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusyBatch(''); }
  }

  return (
    <BrokerScreen title="PDF Inventory" back>
      <View style={{ padding: 14, gap: 10 }}>
        {!allowed ? <Txt>PDF Inventory is available to authorized firm administrators.</Txt> : <>
          <Row wrap gap={6}>
            {canCreate && <Button variant="secondary" size="sm" disabled={progress !== null}
              title={progress === null ? 'Import property from PDF' : `Uploading ${progress}%`} onPress={() => void chooseFile()} />}
            {canCreate && file && progress === null && <Button size="sm" title="Resume upload" onPress={() => void upload(file, captureAccountContext())} />}
            <Button size="sm" title="Filters" variant="secondary" onPress={() => { setDraft(filters); setFiltersOpen(true); }} />
            <Button size="sm" title={importsOpen ? 'Hide imports' : 'PDF imports'} variant="secondary" onPress={() => setImportsOpen(!importsOpen)} />
          </Row>
          {importsOpen && data.data?.batches.map((batch) => (
            <NativeCard key={batch.id}>
              <Txt v="bodyStrong">{batch.fileName}</Txt>
              <Txt>{batch.status}{batch.metadata?.reviewPages?.length ? ` · Review pages ${batch.metadata.reviewPages.join(', ')}` : ''}</Txt>
              {batch.lastError && <Txt color="muted">{batch.lastError}</Txt>}
              {canCreate && ['FAILED', 'PARTIAL'].includes(batch.status) && <Button variant="secondary" size="sm" title="Retry" disabled={busyBatch === batch.id} onPress={() => void retry(batch.id)} />}
            </NativeCard>
          ))}
          {data.isPending ? <Loader /> : data.error ? <ErrorView error={data.error} onRetry={() => data.refetch()} /> : <>
            {!data.data.items.length && <Txt color="muted">No matching PDF properties.</Txt>}
            {data.data.items.map((item) => <NativeCard key={item.id} onPress={() => setRow(item)}>
              <Txt v="bodyStrong">{item.address || 'Address to review'}</Txt>
              <Txt v="caption">{[item.sector || item.locality, item.configuration, item.floor, item.areaSqft && item.areaSqft + ' sq ft'].filter(Boolean).join(' · ')}</Txt>
              <Txt v="caption">{item.monthlyRent == null ? '' : '₹' + item.monthlyRent.toLocaleString('en-IN') + ' · '}{item.availability} · {item.review.replaceAll('_', ' ')}</Txt>
              <Txt v="caption" color="muted">Page {item.pageNo}, row {item.rowNo}</Txt>
              <Button size="sm" title="Open property" variant="secondary" onPress={() => setRow(item)} />
            </NativeCard>)}
            <Row gap={8}>
              <Button size="sm" title="Previous" variant="secondary" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Txt>Page {page}</Txt>
              <Button size="sm" title="Next" variant="secondary" disabled={page * 30 >= data.data.total} onPress={() => setPage(page + 1)} />
            </Row>
          </>}
        </>}
      </View>
      <Sheet open={allowed && filtersOpen} onClose={() => setFiltersOpen(false)} title="PDF filters" full footer={
        <Row gap={8}><Button title="Clear" variant="secondary" onPress={() => setDraft({})} />
          <Button title="Apply filters" onPress={() => { setFilters(draft); setPage(1); setFiltersOpen(false); }} /></Row>
      }>
        {pdfInventoryFilterFields.map(([name, label]) => <Input key={name} label={label} value={draft[name] ?? ''} onChangeText={(value) => setDraft({ ...draft, [name]: value })} />)}
        <ChoiceField label="Availability" value={draft.availability || null} choices={['UNKNOWN', 'AVAILABLE', 'RENTED']} emptyLabel="Any" onChange={(value) => setDraft({ ...draft, availability: value ?? '' })} />
        <ChoiceField label="Review status" value={draft.review || null} choices={['SAVED', 'NEEDS_REVIEW', 'DUPLICATE']} emptyLabel="Any" onChange={(value) => setDraft({ ...draft, review: value ?? '' })} />
        <ChoiceField label="PDF batch" value={draft.batchId || null} choices={data.data?.batches.map(({ id }) => id) ?? []} emptyLabel="All PDFs"
          labels={Object.fromEntries(data.data?.batches.map(({ id, fileName }) => [id, fileName ?? id]) ?? [])} onChange={(value) => setDraft({ ...draft, batchId: value ?? '' })} />
      </Sheet>
      {allowed && row && <RowEditor key={row.id} row={row} canEdit={canEdit} canDelete={canDelete} canReadContacts={canReadContacts}
        close={() => setRow(null)} refresh={() => cache.invalidateQueries({ queryKey: ['pdf-inventory'] })} />}
    </BrokerScreen>
  );
}

function RowEditor({ row, canEdit, canDelete, canReadContacts, close, refresh }: { row: PdfInventoryRow; canEdit: boolean; canDelete: boolean; canReadContacts: boolean; close: () => void; refresh: () => Promise<void> }) {
  const editableFields = pdfInventoryEditableFields.filter(([key]) => canReadContacts || (key !== 'ownerName' && key !== 'notes'));
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(
    [...pdfInventoryEditableFields.map(([key]) => [key, String(row[key] ?? '')]), ['contacts', row.contacts?.join(', ') ?? ''], ['availability', row.availability ?? 'UNKNOWN']],
  ));
  const [busy, setBusy] = useState(false);

  async function save(archive: boolean, ownerContext = captureAccountContext()) {
    const contacts = fields.contacts.split(/[ ,;\n]+/).filter(Boolean).map(normalizeIndianPhone);
    if (!archive && contacts.some((value) => !value)) return toast.error('Enter valid Indian mobile numbers separated by commas');
    const changes = Object.fromEntries(editableFields.map(([key]) => [
      key, !fields[key].trim() ? null : key === 'areaSqft' || key === 'monthlyRent' ? Number(fields[key]) : fields[key],
    ]));
    setBusy(true);
    try {
      await api(`${endpoint}/${row.id}`, archive ? { method: 'DELETE', ownerContext } : {
        method: 'PATCH', ownerContext, body: { ...changes, availability: fields.availability, ...(canReadContacts ? { contacts: [...new Set(contacts)] } : {}), expectedUpdatedAt: row.updatedAt, reviewed: true },
      });
      await refresh();
      close();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={() => { if (!busy) close(); }} title={row.address || 'PDF property'} full footer={<Row gap={8} wrap>
      {canDelete && <Button title="Archive" variant="secondary" disabled={busy} onPress={() => {
        const ownerContext = captureAccountContext();
        Alert.alert('Archive this PDF property?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void save(true, ownerContext) }]);
      }} />}
      {canEdit && <Button title="Save review" disabled={busy} onPress={() => void save(false)} />}
    </Row>}>
      {editableFields.map(([key, label]) => (
        <Input key={key} label={label} value={fields[key]} editable={canEdit} onChangeText={(value) => setFields({ ...fields, [key]: value })} />
      ))}
      {canReadContacts && <Input label="Contacts" value={fields.contacts} editable={canEdit} onChangeText={(value) => setFields({ ...fields, contacts: value })} />}
      {canEdit ? <ChoiceField label="Availability" value={fields.availability} choices={['UNKNOWN', 'AVAILABLE', 'RENTED']}
        onChange={(value) => setFields({ ...fields, availability: value ?? 'UNKNOWN' })} /> : <Txt>{fields.availability}</Txt>}
      <Txt v="bodyStrong">Source · page {row.pageNo}, row {row.rowNo}</Txt>
      {canReadContacts && <Txt>{row.rawText}</Txt>}
    </Sheet>
  );
}
