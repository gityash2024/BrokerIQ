'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Lock, Search } from 'lucide-react';
import { API_URL, formatDate, qs } from '@/lib/utils';
import { useDebounced } from '@/lib/hooks';
import { timeAgo } from '@brokeriq/shared';
import { api, authStore } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Empty, PageLoader } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { Map } from '@/components/site/map';

export default function UserDataDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const q = useQuery({ queryKey: ['admin-user-data', id, dq], queryFn: () => api<any>(`/admin/user-data/${id}${qs({ q: dq })}`), placeholderData: (p) => p });
  const exportCsv = async () => {
    const token = authStore.get()?.accessToken;
    const r = await fetch(`${API_URL}/api/admin/user-data/${id}/contacts.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <PageLoader />;
  const { user, consents, locations, contacts, contactsTotal } = q.data;
  return (
    <>
      <PageHeader title={user.name} subtitle={`${user.email}${user.phone ? ` · ${user.phone}` : ''} · ${user.organization?.name ?? user.role}`} actions={contactsTotal > 0 && <Button variant="secondary" onClick={exportCsv}><Download className="size-4" /> Contacts CSV</Button>} />
      <p className="mb-4 flex items-center gap-2 text-xs text-muted"><Lock className="size-3.5" /> यह view audit log में दर्ज हो गया है।</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <p className="font-display font-bold">Contacts ({contactsTotal})</p>
            <div className="ml-auto w-full sm:w-64"><Input icon={<Search className="size-4" />} className="h-9" placeholder="नाम / नंबर / email" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          {!contacts.length ? (
            <Empty title={contactsTotal ? 'कोई match नहीं' : 'Contacts share नहीं किए गए'} />
          ) : (
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs font-bold text-subtle uppercase">
                  <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Email</th></tr>
                </thead>
                <tbody>
                  {contacts.map((c: any) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-2">{c.name ?? '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-2 text-xs text-muted">{c.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="space-y-5">
          <div className="card h-72 overflow-hidden">
            {locations.length ? (
              <Map points={locations.map((l: any, i: number) => ({ id: l.id, lat: l.latitude, lng: l.longitude, label: `${i === 0 ? 'Latest · ' : ''}${formatDate(l.capturedAt)}`, dot: true }))} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">Location share नहीं की गई</div>
            )}
          </div>
          <div className="card p-4">
            <p className="mb-2 font-display font-bold">Consent history</p>
            <div className="space-y-2 text-sm">
              {consents.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <span>{c.kind === 'LOCATION' ? 'Location' : 'Contacts'} · <span className="text-xs text-muted">{c.platform ?? '—'} · v{c.policyVersion}</span></span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.granted ? 'success' : 'warning'}>{c.granted ? 'Allowed' : 'Withdrawn'}</Badge>
                    <span className="text-xs text-subtle">{timeAgo(c.createdAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
