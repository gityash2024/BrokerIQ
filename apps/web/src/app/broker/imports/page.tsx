'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { toast } from 'sonner';
export default function ImportsPage() {
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['imports', page], queryFn: () => api<any>(`/imports?page=${page}`), refetchInterval: 5000 });
  async function capture(body: any) {
    setBusy(true);
    setError('');
    try {
      const result = await api<any>('/imports', { body });
      setText('');
      await qc.invalidateQueries({ queryKey: ['imports'] });
      toast.success('Source saved. Review before importing.');
      window.location.assign(`/broker/imports/${result.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (file.size > 12 * 1024 * 1024) {
      setError('Use files up to 12MB. Larger registers use the controlled import pipeline.');
      return;
    }
    const isText = file.name.endsWith('.txt');
    if (isText) {
      await capture({ sourceType: 'CHAT_EXPORT', rawText: await file.text(), fileName: file.name, groupName: group });
      return;
    }
    const bytes = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const fixed = file.name.endsWith('.zip') ? bytes.replace(/^data:[^;]+;/, 'data:application/zip;') : bytes;
    await capture({ sourceType: file.name.endsWith('.zip') ? 'CHAT_EXPORT' : 'IMAGE', fileDataUrl: fixed, fileName: file.name, groupName: group });
  }
  return (
    <>
      <PageHeader
        title="Capture & review"
        subtitle="Paste a WhatsApp message, upload a screenshot or import a chat export."
        actions={
          <Link href="/broker/inbox" className="text-sm font-semibold text-brand-600">
            Back to inbox
          </Link>
        }
      />
      <div className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <input
          aria-label="Source group name"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="Group/source name (optional)"
          className="mb-3 w-full rounded-lg border border-line bg-surface p-3 text-sm"
        />
        <textarea
          aria-label="Message to import"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the original message here…"
          className="w-full rounded-xl border border-line bg-surface p-3 text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            disabled={busy || !text.trim()}
            onClick={() => capture({ sourceType: 'TEXT', rawText: text, groupName: group })}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving source…' : 'Save & extract'}
          </button>
          <label className="cursor-pointer rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">
            Screenshot / TXT / ZIP
            <input
              type="file"
              disabled={busy}
              accept="image/jpeg,image/png,image/webp,.txt,.zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">Sources are retained. No property is added until you approve its details.</p>
      </div>
      {query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : (
        <div className="space-y-3">
          {query.data?.items.map((item: any) => (
            <Link
              href={`/broker/imports/${item.id}`}
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
            >
              <div>
                <p className="font-semibold">{item.fileName || item.groupName || `${item.sourceType} capture`}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString()} · {item._count.entries} source entries
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">{item.status}</span>
            </Link>
          ))}
          {query.data?.total === 0 && <p className="p-6 text-center text-muted">Capture your first source to start review.</p>}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-5 text-sm">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </>
  );
}
