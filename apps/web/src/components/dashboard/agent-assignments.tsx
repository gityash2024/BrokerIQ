'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { agentAssignmentColumns, canViewAgentAssignmentDashboard, moduleAllowed, type AgentAssignmentDashboard } from '@brokeriq/shared';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';

export function AgentAssignments() {
  const { user } = useAuth();
  const { modules } = useConfig();
  const allowed = canViewAgentAssignmentDashboard(user) && moduleAllowed(modules, 'team', 'BROKER_ADMIN');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['agent-assignments', user?.organization?.id, user?.id, user?.role],
    queryFn: () => api<AgentAssignmentDashboard>('/broker/dashboard/agent-assignments'),
    enabled: allowed && open,
    refetchInterval: 60000,
  });
  if (!allowed) return null;
  const columns = agentAssignmentColumns.filter(({ key }) => query.data?.columns.includes(key));
  const rows = query.data?.agents.filter(({ name }) => name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section aria-label="Agent assignments" className="card min-w-0 p-4">
      <Button variant="secondary" aria-expanded={open} aria-controls="agent-assignment-report" onClick={() => setOpen(!open)}>
        <ClipboardList className="size-4" /> Agent assignments
      </Button>
      {open && (
        <div id="agent-assignment-report" className="mt-3 space-y-3">
          {query.isPending ? (
            <p role="status" className="text-sm text-muted">
              Loading assignments…
            </p>
          ) : query.error ? (
            <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <>
              <p className="text-sm text-muted">Current assignees across all statuses.</p>
              {!query.data.agents.length ? (
                <p className="text-sm text-muted">
                  {query.data.scope === 'MANAGED_AGENTS'
                    ? 'Your Broker Admin hasn’t selected any active agents for this report.'
                    : 'No active agents in this firm.'}
                </p>
              ) : (
                <>
                  <input
                    type="search"
                    aria-label="Search assigned agents"
                    placeholder="Search agents"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="min-h-11 w-full max-w-72 rounded-xl border border-line bg-surface px-3 text-sm"
                  />
                  {!rows?.length ? (
                    <p className="text-sm text-muted">No agents match your search.</p>
                  ) : (
                    <div className="max-h-96 overflow-auto rounded-xl border border-line">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-surface-2">
                          <tr>
                            <th scope="col" className="px-3 py-2">
                              Agent
                            </th>
                            {columns.map(({ key, label }) => (
                              <th key={key} scope="col" className="px-3 py-2 text-right">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ id, name, counts }) => (
                            <tr key={id} className="border-t border-line">
                              <th scope="row" className="px-3 py-2 font-medium">
                                {name}
                              </th>
                              {columns.map(({ key }) => (
                                <td key={key} className="px-3 py-2 text-right tabular-nums">
                                  {counts[key]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
