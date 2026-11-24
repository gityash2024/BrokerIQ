'use client';
import { useRouteState } from '@/lib/navigation';
import { surveySectors } from '@brokeriq/shared';
import { InventoryFolderControls, useInventoryFolderDefinitions } from './inventory-folder-controls';
import { LoadingArtwork } from '@/components/ui/request-loader';
import Link from 'next/link';
import { IMPORT_MAX_BYTES, hasDelegatedAccess, inventoryMonth, inventoryMonthSchema, uploadImport } from '@brokeriq/shared';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ClipboardPaste, FileArchive, FileImage, ScanLine, ShieldCheck, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { api, errorMessage, captureAccountContext } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { readPrivateDraft, writePrivateDraft, LEGACY_WEB_DRAFT_REVIEW } from '@/lib/private-drafts';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';

type Target = 'AUTO' | 'INVENTORY' | 'REQUIREMENT' | 'SURVEY';
export function CaptureWorkspace({ scanner = false }: { scanner?: boolean }) {
  useAuth();
  const context = captureAccountContext();
  const account = `${context.scope}:${context.revision}`;
  return (
    <Suspense>
      <Workspace key={account} scanner={scanner} />
    </Suspense>
  );
}
function Workspace({ scanner }: { scanner: boolean }) {
  const params = useSearchParams();
  const survey = scanner && params.get('target') === 'SURVEY';
  const requestedSector = survey ? (params.get('sector')?.trim() ?? '') : '';
  const composeKey = survey ? 'survey-capture:' + requestedSector : 'capture';
  const { user } = useAuth();
  const cutover = useConfig().flags.connect_whatsapp_cutover === true;
  const owner = useRef(captureAccountContext()).current;
  const [startSeparate, setStartSeparate] = useState(false);

  const [text, setText] = useState(''),
    [group, setGroup] = useState('');
  const [target, setTarget] = useState<Target>(
    survey
      ? 'SURVEY'
      : ['INVENTORY', 'REQUIREMENT'].includes(params.get('target') ?? '')
        ? (params.get('target') as Target)
        : user?.role === 'BROKER_AGENT'
          ? 'REQUIREMENT'
          : 'AUTO',
  );
  const suggestedMonth = inventoryMonthSchema.safeParse(params.get('directoryMonth'));
  const [directoryMonth, setDirectoryMonth] = useState(suggestedMonth.success ? suggestedMonth.data : inventoryMonth());
  const captureMonth = target === 'INVENTORY' ? directoryMonth : undefined;
  const [registerSector, setRegisterSector] = useState(requestedSector);
  const folderDefinitions = useInventoryFolderDefinitions(scanner);
  const savedSectors = (folderDefinitions.data ?? []).filter(({ kind }) => kind === 'SECTOR').map(({ label }) => label);
  const localities = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<{ name: string }[]>('/public/localities', { auth: false }),
    enabled: scanner,
    staleTime: 600_000,
  });
  const [registerSessionId, setRegisterSessionId] = useState(() => crypto.randomUUID());
  const registerNextPage = useRef(1);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [status, setStatus] = useRouteState('capture-workspace.status', '');
  const [page, setPage] = useRouteState('capture-workspace.page', 1),
    [completed, setCompleted] = useState<{ id: string; name: string }[]>([]);
  const files = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    images = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve()),
    lock = useRef(false),
    remaining = useRef<File[]>([]);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['imports', page], queryFn: () => api<any>(`/imports?page=${page}`), refetchInterval: 5000 });
  useEffect(() => {
    let live = true;
    setReady(false);
    if (owner.userId)
      void readPrivateDraft<{
        text: string;
        group: string;
        target: Target;
        entryTarget?: string | null;
        directoryMonth?: string;
        registerSessionId?: string;
        registerNextPage?: number;
        registerSector?: string;
      }>(owner, composeKey, startSeparate)
        .then((saved) => {
          if (!live) return;
          if (saved) {
            setText(saved.text);
            setGroup(saved.group);
            setRegisterSector(saved.registerSector ?? requestedSector);
            if (saved.registerSessionId) setRegisterSessionId(saved.registerSessionId);
            registerNextPage.current = saved.registerNextPage ?? 1;
            if (!survey && (!params.get('target') || saved.entryTarget === params.get('target'))) setTarget(saved.target);
            if (!suggestedMonth.success && saved.directoryMonth) setDirectoryMonth(saved.directoryMonth);
            setStatus('Private draft restored');
          }
          setReady(true);
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        });
    return () => {
      live = false;
    };
  }, [owner, startSeparate, composeKey]);
  useEffect(() => {
    if (!owner.userId || !ready) return;
    const version = ++revision.current;
    setStatus('Saving encrypted draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() =>
        writePrivateDraft(owner, composeKey, {
          text,
          group,
          target,
          directoryMonth,
          entryTarget: params.get('target'),
          registerSessionId,
          registerNextPage: registerNextPage.current,
          registerSector,
        }),
      )
      .then(() => {
        if (version === revision.current) setStatus('Encrypted draft saved in this browser');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [text, group, target, directoryMonth, ready, owner, registerSessionId, registerSector, composeKey]);
  async function capture(body: Record<string, unknown>, name: string) {
    const result = await api<{ id: string }>('/imports', {
      ownerContext: owner,
      body: { ...body, groupName: group || undefined, target, directoryMonth: captureMonth },
    });
    setCompleted((rows) => [...rows, { id: result.id, name }]);
    await qc.invalidateQueries({ queryKey: ['imports'] });
    return result.id;
  }
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (target === 'INVENTORY' && !inventoryMonthSchema.safeParse(captureMonth).success) throw new Error('Choose the inventory year and month.');
      if (survey && !registerSector) throw new Error('Choose the sector before scanning the survey register.');
      await writes.current;
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function upload(selected: File[]) {
    if (!owner.userId) throw new Error('Sign in again before uploading a private source.');
    remaining.current = selected;
    for (const file of selected) {
      if (!file.size || file.size > IMPORT_MAX_BYTES) throw new Error(`${file.name}: maximum 300 MB per source. Earlier successful sources remain saved.`);
      const zip = /\.zip$/i.test(file.name);
      const text = /\.txt$/i.test(file.name);
      const contentType = zip ? 'application/zip' : text ? 'text/plain' : file.type;
      if (!['application/zip', 'text/plain', 'image/jpeg', 'image/png', 'image/webp'].includes(contentType))
        throw new Error(`${file.name}: unsupported source type`);
      const fingerprintBytes = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
      const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', fingerprintBytes)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const identity = `${scanner ? registerSessionId + ':' : ''}${file.name}:${file.size}:${file.lastModified}:${fingerprint}:${group}:${target}${captureMonth ? ':' + captureMonth : ''}`;
      const identityHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const draftName = `capture-upload:${identityHash}`;
      let upload = await readPrivateDraft<{ clientKey: string; registerSessionId?: string; registerPageNo?: number; registerSector?: string }>(
        owner,
        draftName,
        startSeparate,
      );
      if (!upload) {
        upload = {
          clientKey: crypto.randomUUID(),
          ...(scanner && contentType.startsWith('image/')
            ? { registerSessionId, registerPageNo: registerNextPage.current, registerSector: registerSector || undefined }
            : {}),
        };
        await writePrivateDraft(owner, draftName, upload);
        if (upload.registerPageNo) {
          registerNextPage.current = upload.registerPageNo + 1;
          await writePrivateDraft(owner, 'capture', {
            text,
            group,
            target,
            directoryMonth,
            entryTarget: params.get('target'),
            registerSessionId,
            registerNextPage: registerNextPage.current,
          });
        }
      }
      const result = await uploadImport(
        (path, body) => api(path, { ownerContext: owner, body }),
        {
          clientKey: upload.clientKey,
          fileName: file.name,
          totalBytes: file.size,
          contentType,
          sourceType: text || zip ? 'CHAT_EXPORT' : 'IMAGE',
          groupName: group || undefined,
          target,
          directoryMonth: captureMonth,
          registerSessionId: upload.registerSessionId,
          registerPageNo: upload.registerPageNo,
          registerSector: upload.registerSector,
        },
        (offset, length) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(new Error('File could not be read. Reselect the original to resume.'));
            reader.readAsDataURL(file.slice(offset, offset + length));
          }),
        (received, total) => setStatus(`${file.name} · ${Math.floor((received / total) * 100)}% uploaded · encrypted chunks`),
      );
      setCompleted((rows) => [...rows, { id: result.id, name: file.name }]);
      await qc.invalidateQueries({ queryKey: ['imports'] });
      remaining.current = remaining.current.filter((f) => f !== file);
    }
  }
  const select = (list: FileList | null) => {
    // Snapshot before resetting the input: FileList is live, and draft persistence is asynchronous.
    const selected = list ? Array.from(list) : [];
    if (selected.length) void perform(() => upload(selected));
  };
  return (
    <>
      {scanner && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <label className="text-sm font-semibold">
            Register sector
            <select
              value={registerSector}
              onChange={(event) => {
                setRegisterSector(event.target.value);
                setRegisterSessionId(crypto.randomUUID());
                registerNextPage.current = 1;
                setCompleted([]);
              }}
              disabled={busy || !ready}
              className="ml-3 rounded-xl border border-line bg-surface p-2"
            >
              <option value="">{survey ? 'Choose sector first' : 'Read from page heading'}</option>
              {surveySectors([...(registerSector ? [registerSector] : []), ...savedSectors, ...(localities.data ?? []).map((locality) => locality.name)]).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <InventoryFolderControls sectorsOnly onCreated={(folder) => {
            setRegisterSector(folder.label);
            setRegisterSessionId(crypto.randomUUID());
            registerNextPage.current = 1;
            setCompleted([]);
          }} />
          <p className="text-sm text-muted">The selected sector applies until a new register heading is found.</p>
          <Button
            variant="secondary"
            disabled={busy || !ready}
            onClick={() => {
              setRegisterSessionId(crypto.randomUUID());
              registerNextPage.current = 1;
              if (survey) setRegisterSector('');
              setCompleted([]);
            }}
          >
            Start a new register
          </Button>
        </div>
      )}
      <PageHeader
        title={survey ? 'Scan survey register' : scanner ? 'Scanner & import' : 'Capture workspace'}
        subtitle="Original sources, clear review and accurate Inventory / Requirements."
        actions={
          <Link href="/broker/inbox" className="text-sm font-semibold text-brand-600">
            Open Inbox →
          </Link>
        }
      />
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-brand-600 p-6 text-white sm:p-8">
        <ScanLine className="absolute -right-8 -top-6 size-56 rotate-12 text-white/5" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-200">Capture → Review → Save</p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-bold">Every source. One clear workflow.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">
          {cutover ? 'Scan register pages or paste a message.' : 'Scan register pages, import a complete WhatsApp chat or paste a message.'}{' '}
          Every extracted property and requirement stays in review until you approve it.
        </p>
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
        <div className="space-y-5">
          {!survey && (
            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold">What are you adding?</h2>
              <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Review destination">
                {(['AUTO', 'INVENTORY', 'REQUIREMENT'] as const)
                  .filter((v) => v !== 'INVENTORY' || hasDelegatedAccess(user, 'inventory', 'create'))
                  .map((value) => (
                    <button
                      key={value}
                      aria-pressed={value === target}
                      onClick={() => setTarget(value)}
                      className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${target === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface-2'}`}
                    >
                      {{ AUTO: 'Auto detect', INVENTORY: 'Inventory', REQUIREMENT: 'Requirements' }[value]}
                    </button>
                  ))}
              </div>
              {target === 'INVENTORY' && (
                <label className="mb-3 block text-xs font-semibold text-muted">
                  Inventory year and month
                  <input
                    type="month"
                    value={directoryMonth}
                    onChange={(event) => setDirectoryMonth(event.target.value)}
                    className="mt-2 block rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                  />
                </label>
              )}
              <label className="block text-xs font-semibold text-muted">
                Group / source name
                <input
                  value={group}
                  disabled={!ready || busy}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="WhatsApp group, register or contact (optional)"
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-fg"
                />
              </label>
              <p className="mt-3 text-xs leading-5 text-muted">
                Destination guides review; it never changes the original message or silently converts a requirement into a property.
              </p>
            </section>
          )}
          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Camera className="size-5 text-brand-600" /> Scan & upload
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button loading={busy} disabled={!ready || (survey && !registerSector)} onClick={() => camera.current?.click()}>
                <Camera className="size-4" /> Camera scan
              </Button>
              <Button variant="secondary" disabled={!ready || busy || (survey && !registerSector)} onClick={() => images.current?.click()}>
                <FileImage className="size-4" /> Multiple page images
              </Button>
              {!survey && !cutover && (
                <Button className="sm:col-span-2" variant="secondary" disabled={!ready || busy} onClick={() => files.current?.click()}>
                  <FileArchive className="size-4" /> WhatsApp export · TXT / ZIP / Images
                </Button>
              )}
            </div>
            <input
              ref={camera}
              aria-label="Camera scan source"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={(e) => {
                select(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={images}
              aria-label="Register page images"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                select(e.target.files);
                e.target.value = '';
              }}
            />
            {!cutover && <input
              ref={files}
              aria-label="WhatsApp chat export files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,.txt,.zip"
              hidden
              onChange={(e) => {
                select(e.target.files);
                e.target.value = '';
              }}
            />}
            <p className="mt-4 text-xs leading-5 text-muted">
              Up to 300 MB per source. Resumable encrypted uploads. Use the{' '}
              <Link href="/broker/scanner/listing-drafts" className="font-semibold text-brand-600 underline">
                public rental draft scanner
              </Link>{' '}
              for page preview, rotation and listing drafts.
            </p>
          </section>
          {!survey && (
            <section className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold">
                  <ClipboardPaste className="size-5 text-brand-600" /> Paste & fill
                </h2>
                <Button variant="ghost" disabled={!ready || busy} onClick={() => perform(async () => setText(await navigator.clipboard.readText()))}>
                  Paste clipboard
                </Button>
              </div>
              <label className="sr-only" htmlFor="capture-message">
                Original message
              </label>
              <textarea
                id="capture-message"
                rows={8}
                value={text}
                disabled={!ready || busy}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the original property / requirement message…"
                className="my-4 w-full resize-y rounded-xl border border-line bg-surface p-4 text-sm leading-6"
              />
              <Button
                loading={busy}
                disabled={!ready || !text.trim()}
                onClick={() =>
                  perform(async () => {
                    await capture({ sourceType: 'TEXT', rawText: text }, 'Pasted message');
                  })
                }
              >
                Save & extract for review
              </Button>
              <p className="mt-3 text-xs text-muted" role="status">
                {status}
              </p>
            </section>
          )}
          {error === LEGACY_WEB_DRAFT_REVIEW && (
            <Button
              variant="secondary"
              onClick={() => {
                setError('');
                setStartSeparate(true);
              }}
            >
              Start a separate draft
            </Button>
          )}
          {!!error && (
            <div role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-500/5 p-5">
              <p className="text-sm">{error}</p>
              {!!remaining.current.length && (
                <Button className="mt-3" variant="secondary" onClick={() => perform(() => upload(remaining.current))}>
                  Retry remaining files
                </Button>
              )}
            </div>
          )}
        </div>
        <aside className="space-y-5">
          <section className="card p-6">
            <ShieldCheck className="size-7 text-brand-600" />
            <h2 className="mt-3 text-lg font-bold">Private by default</h2>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-muted">
              <li>
                <strong className="text-fg">01 · Capture.</strong> Originals stay in your firm’s private source history.
              </li>
              <li>
                <strong className="text-fg">02 · Review.</strong> Check extracted fields; add or correct Inventory and Requirements separately.
              </li>
              <li>
                <strong className="text-fg">03 · Approve.</strong> Create ledger records only after confirmation. Public publishing is a separate action.
              </li>
            </ol>
          </section>
          {cutover ? (
            hasDelegatedAccess(user, 'inventory', 'view') && <Link href="/broker/inventory/pdf" className="card block p-6 font-bold">Import properties from PDF</Link>
          ) : <section className="card p-6">
            <h2 className="font-bold">Export a WhatsApp chat</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Open a chat → More → Export chat. Choose TXT or ZIP, then upload here. On Android, share directly to BrokerIQ. This imports your export; it does
              not send messages.
            </p>
          </section>}
          {!!completed.length && (
            <section className="card p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="size-5 text-emerald-600" /> Saved sources
              </h2>
              {completed.map((item, i) => (
                <Link
                  key={`${item.id}-${i}`}
                  href={`/broker/imports/${item.id}`}
                  className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm"
                >
                  <span className="min-w-0 truncate">{item.name}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-brand-600" />
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
      <h2 className="mb-4 mt-9 font-display text-xl font-bold">Source history & review</h2>
      {query.error ? (
        <div role="alert" className="card p-6">
          {errorMessage(query.error)}
          <Button variant="ghost" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.isPending ? (
        <LoadingArtwork className="h-24" label="Loading sources" />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
          {query.data?.items.map((item: any) => (
            <Link
              key={item.id}
              href={`/broker/imports/${item.id}`}
              className="card flex min-w-0 flex-col items-start justify-between gap-4 p-5 transition hover:border-brand-400 sm:flex-row sm:items-center"
            >
              <div className="w-full min-w-0 sm:flex-1">
                <p className="truncate font-semibold">{item.fileName || item.groupName || `${item.sourceType} capture`}</p>
                <p className="mt-2 break-words text-xs leading-5 text-muted">
                  {new Date(item.createdAt).toLocaleString('en-IN')} · {item._count?.entries ?? 0} source entries
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold">
                {item.previewOfImportId ? 'PREVIEW · ' : ''}
                {item.status.replaceAll('_', ' ')}
              </span>
            </Link>
          ))}
          {query.data?.total === 0 && (
            <p className="card col-span-full p-8 text-center text-muted">No sources captured yet. Scan, paste or import above to begin.</p>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </>
  );
}
