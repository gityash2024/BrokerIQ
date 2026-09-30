'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { cn, formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Input, Select } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { UserActions, UserSheet } from '@/components/admin/controls';

const ROLE_TONE: Record<string, any> = {
  SUPER_ADMIN: 'danger',
  MODERATOR: 'warning',
  SUPPORT: 'warning',
  BROKER_ADMIN: 'brand',
  BROKER_AGENT: 'info',
  USER: 'neutral',
};

export default function UsersPage() {
  const [f, setF] = useState({ q: '', role: '', status: '', page: 1 });
  const dq = useDebounced(f.q);
  const q = useQuery({ queryKey: ['admin-users', { ...f, q: dq }], queryFn: () => api<any>(`/admin/users${qs({ ...f, q: dq })}`), placeholderData: (p) => p });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Users" subtitle={q.data ? `${q.data.total} accounts` : ' '} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-full sm:w-72">
          <Input
            icon={<Search className="size-4" />}
            className="h-10"
            placeholder="नाम, email, phone"
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })}
          />
        </div>
        <Select className="h-10 w-44" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, page: 1 })}>
          <option value="">All roles</option>
          <option value="USER">User / Owner</option>
          <option value="BROKER_ADMIN">Broker admin</option>
          <option value="BROKER_AGENT">Broker agent</option>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="MODERATOR">Moderator</option>
          <option value="SUPPORT">Support</option>
        </Select>
        <Select className="h-10 w-36" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}>
          <option value="">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Blocked</option>
        </Select>
      </div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !q.data.items.length ? (
        <Empty title="कोई user नहीं मिला" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Firm</th>
                  <th className="px-4 py-3 text-center">Listings</th>
                  <th className="px-4 py-3 text-center">Enquiries</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Last login</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((u: any) => (
                  <tr
                    key={u.id}
                    onClick={() => setOpen(u.id)}
                    className={cn('cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/50', u.status === 'SUSPENDED' && 'opacity-60')}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {u.name}
                            {u.emailVerified && <CheckCircle2 className="ml-1 inline size-3.5 text-emerald-500" />}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {u.email}
                            {u.phone ? ` · ${u.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={ROLE_TONE[u.role]}>{u.role.replace('_', ' ')}</Badge>
                      {u.status === 'SUSPENDED' && (
                        <Badge tone="danger" className="ml-1">
                          Blocked
                        </Badge>
                      )}
                      {u.restrictions?.length > 0 && (
                        <Badge tone="warning" className="ml-1">
                          {u.restrictions.length} restricted
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{u.organization?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center">{u._count.listings}</td>
                    <td className="px-4 py-2.5 text-center">{u._count.enquiries}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <UserActions u={u} onOpen={() => setOpen(u.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(p) => setF({ ...f, page: p })} />
        </>
      )}
      <UserSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}
