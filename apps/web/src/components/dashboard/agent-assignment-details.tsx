'use client';
import { useRouteState } from '@/lib/navigation';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { agentAssignmentColumns, readableValue, type AgentAssignmentKind, type AgentAssignmentRecords } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function AgentAssignmentDetails({
  agent,
  columns,
  onClose,
}: {
  agent: { id: string; name: string };
  columns: AgentAssignmentKind[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [selectedKind, setKind] = useState(columns[0]);
  const [page, setPage] = useRouteState('agent-assignment-details.page', 1);
  const kind = columns.includes(selectedKind) ? selectedKind : columns[0];
  const query = useQuery({
    queryKey: ['agent-assignment-records', user?.organization?.id, user?.id, agent.id, kind, page],
    queryFn: () => api<AgentAssignmentRecords>(`/broker/dashboard/agent-assignments/${encodeURIComponent(agent.id)}?kind=${kind}&page=${page}`),
    enabled: !!kind,
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${agent.name} · Assignments`}
      size="lg"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Assignment category">
          {agentAssignmentColumns
            .filter(({ key }) => columns.includes(key))
            .map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={key === kind ? 'primary' : 'secondary'}
                aria-pressed={key === kind}
                onClick={() => {
                  setKind(key);
                  setPage(1);
                }}
              >
                {label}
              </Button>
            ))}
        </div>
        {query.error ? (
          <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isPending ? (
          <p role="status" className="text-sm text-muted">
            Loading assigned records…
          </p>
        ) : (
          <>
            {!query.data.items.length && <p className="text-sm text-muted">No assigned records on this page.</p>}
            {query.data.items.map(({ id, recordId, title, status, summary, at }) => {
              const record = encodeURIComponent(recordId);
              const href =
                kind === 'properties'
                  ? `/broker/inventory/${record}`
                  : kind === 'requirements'
                    ? `/broker/leads/requirements/${record}/edit`
                    : `/broker/leads/${record}${kind === 'leads' ? '' : '?tab=tasks'}`;
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <div className="min-w-0 flex-1 break-words">
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted">
                      {readableValue(status)}
                      {at ? ` · ${new Date(at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}
                    </p>
                    {summary && <p className="mt-1 whitespace-pre-line text-sm text-fg">{summary}</p>}
                  </div>
                  <Button href={href} variant="secondary" size="sm" aria-label={`Open ${title}`}>
                    Open <ChevronRight className="size-4" />
                  </Button>
                </div>
              );
            })}
            {(page > 1 || query.data.hasMore) && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm">Page {page}</span>
                <Button size="sm" variant="secondary" disabled={!query.data.hasMore} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
