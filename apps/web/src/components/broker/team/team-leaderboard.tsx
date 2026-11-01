'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import type { PerformanceData, PerformanceQuery } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { Select, Input, Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

interface TeamLeaderboardProps {
  members?: unknown[];
  currentUserId?: string;
  isModal?: boolean;
  onClose?: () => void;
  organizationId?: string;
}
export function TeamLeaderboardView({ currentUserId, organizationId }: TeamLeaderboardProps) {
  const { user } = useAuth();
  const [range, setRange] = useState<PerformanceQuery['range']>('MONTH');
  const [dates, setDates] = useState({ from: '', to: '' });
  const [search, setSearch] = useState('');
  const params = new URLSearchParams({ range, ...(range === 'CUSTOM' ? dates : {}), ...(organizationId ? { organizationId } : {}) });
  const query = useQuery({
    queryKey: ['team-performance', user?.id, params.toString()],
    queryFn: () => api<PerformanceData>(`/broker/performance?${params}`),
    enabled: range !== 'CUSTOM' || (!!dates.from && !!dates.to),
  });
  const rows = query.data?.items.filter((item) => `${item.name} ${item.organizationName ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Trophy className="mb-2 size-7 text-amber-500" />
          <h2 className="text-lg font-bold">{user?.role === 'BROKER_AGENT' ? 'My performance' : 'Team Leaderboard'}</h2>
          <p className="mt-1 text-xs text-muted">Actual records for the selected period · IST</p>
        </div>
        <Field label="Reporting period">
          <Select value={range} onChange={(event) => setRange(event.target.value as PerformanceQuery['range'])}>
            <option value="MONTH">This calendar month</option>
            <option value="QUARTER">Last 90 days</option>
            <option value="YEAR">Last 365 days</option>
            <option value="ALL">All time</option>
            <option value="CUSTOM">Custom dates</option>
          </Select>
        </Field>
      </div>
      {range === 'CUSTOM' && (
        <div className="flex flex-wrap gap-3">
          <Field label="From date">
            <Input type="date" value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} />
          </Field>
          <Field label="To date">
            <Input type="date" value={dates.to} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
          </Field>
        </div>
      )}
      {query.data && (
        <p className="text-xs text-muted">
          {range === 'ALL' ? 'All time' : `${query.data.period.from} — ${query.data.period.to}`} · {query.data.definition}
        </p>
      )}
      <Input aria-label="Search performance members" placeholder="Search members or firms" value={search} onChange={(e) => setSearch(e.target.value)} />
      {query.error ? (
        <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isFetching ? (
        <Skeleton className="h-44 rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="p-4 text-left">Member</th>
                <th className="p-4 text-right">Won leads</th>
                <th className="p-4 text-right">New leads</th>
                <th className="p-4 text-right">Activities</th>
                <th className="p-4 text-right">Monthly goal · {query.data?.targetMonth}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className={'border-t border-line ' + (item.id === (currentUserId ?? user?.id) ? 'bg-brand-50/40 dark:bg-brand-500/5' : '')}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {item.rank != null && <span className="w-7 font-bold text-brand-600">#{item.rank}</span>}
                      <Avatar name={item.name} src={item.avatarUrl} size={32} />
                      <span>
                        <span className="block font-semibold">{item.name}</span>
                        <span className="text-xs text-muted">{item.organizationName}</span>
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right tabular-nums">{item.wonLeads}</td>
                  <td className="p-4 text-right tabular-nums">{item.receivedLeads}</td>
                  <td className="p-4 text-right tabular-nums">{item.activities}</td>
                  <td className="p-4 text-right text-xs">
                    {item.targets.monthlyDeals ? `${item.monthlyWonLeads}/${item.targets.monthlyDeals} · ${item.monthlyFulfillment}%` : 'No monthly target'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-8 text-center text-sm text-muted">No matching performance records.</p>}
        </div>
      )}
    </div>
  );
}
export function TeamLeaderboardModal({
  open,
  onOpenChange,
  members,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: unknown[];
  currentUserId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Team Leaderboard" size="xl">
      <TeamLeaderboardView members={members} currentUserId={currentUserId} />
    </Dialog>
  );
}
