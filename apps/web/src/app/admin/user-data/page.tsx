'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Contact, Lock, MapPin, Search } from 'lucide-react';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Input } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { Segmented } from '@/components/ui/tabs';
import { Map } from '@/components/site/map';

const consent = (v: boolean | null) => (v == null ? <Badge>—</Badge> : v ? <Badge tone="success">Allowed</Badge> : <Badge tone="warning">Off</Badge>);

/** Consented location & contacts — Super Admin only; every detail view is audit-logged. */
export default function UserDataPage() {
  const [f, setF] = useState({ q: '', page: 1 });
  const [view, setView] = useState<'list' | 'map'>('list');
  const dq = useDebounced(f.q);
  const q = useQuery({
    queryKey: ['admin-user-data', { ...f, q: dq }],
    queryFn: () => api<any>(`/admin/user-data${qs({ ...f, q: dq })}`),
    placeholderData: (p) => p,
  });
  const map = useQuery({ queryKey: ['admin-user-data-map'], queryFn: () => api<any[]>('/admin/user-data/map'), enabled: view === 'map' });
  return (
    <>
      <PageHeader title="User data (consented)" subtitle="सिर्फ़ Super Admin को दिखता है · users की मर्ज़ी से share हुई location और contacts" />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <Lock className="size-4 shrink-0" />
        <p className="flex-1">
          यह data users ने consent देकर share किया है। हर view/export audit log में दर्ज होता है। इन नंबरों पर बिना उनकी अनुमति marketing call/WhatsApp न करें
          (DPDP Act / TRAI)।
        </p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72">
          <Input
            icon={<Search className="size-4" />}
            className="h-10"
            placeholder="नाम, email, phone"
            value={f.q}
            onChange={(e) => setF({ q: e.target.value, page: 1 })}
          />
        </div>
        <Segmented
          className="ml-auto"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'List' },
            { value: 'map', label: 'Map' },
          ]}
        />
      </div>
      {view === 'map' ? (
        <div className="card h-[560px] overflow-hidden">
          <Map
            points={(map.data ?? []).map((p) => ({
              id: p.userId,
              lat: p.latitude,
              lng: p.longitude,
              label: `${p.name} · ${timeAgo(p.capturedAt)}`,
              href: `/admin/user-data/${p.userId}`,
              dot: true,
            }))}
          />
        </div>
      ) : q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !q.data.items.length ? (
        <Empty title="अभी किसी user ने data share नहीं किया" text="Users app/website पर consent देकर location या contacts share करते हैं।" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contacts</th>
                  <th className="px-4 py-3">Last location</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((u: any) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.name}</p>
                          <p className="truncate text-xs text-muted">
                            {u.email}
                            {u.phone ? ` · ${u.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{u.organization?.name ?? u.role}</td>
                    <td className="px-4 py-2.5">{consent(u.consent.location)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {consent(u.consent.contacts)}
                        {u._count.contacts > 0 && (
                          <span className="text-xs text-muted">
                            <Contact className="inline size-3.5" /> {u._count.contacts}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {u.lastLocation ? (
                        <span>
                          <MapPin className="inline size-3.5" /> {timeAgo(u.lastLocation.capturedAt)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/user-data/${u.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                        देखें →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(page) => setF({ ...f, page })} />
        </>
      )}
    </>
  );
}
