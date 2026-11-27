'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  hasDelegatedAccess,
  surveyPropertyLookupSchema,
  surveyPropertyViews,
  type SurveyPropertyMatch,
  type SurveyPropertyMatchSummary,
} from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, useApiMutation, useDebounced } from '@/lib/hooks';

export function SurveyPropertyMatches({ sector, houseNo, excludeId }: { sector?: string | null; houseNo?: string | null; excludeId?: string }) {
  const { user } = useAuth();
  const canView = !!user && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && hasDelegatedAccess(user, 'inventory', 'view');
  const number = houseNo?.trim() ?? '';
  const debounced = useDebounced(number, 300);
  const lookup = surveyPropertyLookupSchema.safeParse({ sector, houseNo: debounced, includeRestrictedNotice: 'true', ...(excludeId ? { excludeId } : {}) });
  const query = useQuery({
    queryKey: ['survey-property-matches', user?.id, user?.organization?.id, sector, debounced, excludeId],
    staleTime: 0,
    enabled: canView && lookup.success && number === debounced,
    queryFn: () => api<SurveyPropertyMatchSummary | SurveyPropertyMatch[]>('/inventory/survey-property-matches?' + new URLSearchParams(lookup.data)),
  });
  const reopen = useApiMutation(
    (item: SurveyPropertyMatch) => patch(`/inventory/${encodeURIComponent(item.id)}/reopen-survey`, { expectedRevision: item.revision }),
    {
      success: 'Property returned to Survey',
      invalidate: [['survey-property-matches'], ['inventory-folders'], ['inventory-folder-items'], ['broker-today']],
    },
  );
  if (!canView || !lookup.success || number !== debounced) return null;
  if (query.error)
    return (
      <p role="status" className="text-xs text-muted">
        Could not check existing properties.{' '}
        <button type="button" className="underline" onClick={() => void query.refetch()}>
          Retry
        </button>
      </p>
    );
  if (query.isFetching && !query.data)
    return (
      <p role="status" className="text-xs text-muted">
        Checking existing properties…
      </p>
    );
  const items = Array.isArray(query.data) ? query.data : (query.data?.items ?? []);
  const restricted = !Array.isArray(query.data) && query.data?.hasRestrictedMatches;
  if (!items.length && !restricted) return null;
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3" aria-live="polite">
      <p className="text-sm font-semibold">Existing properties at this address</p>
      {restricted && (
        <p className="text-sm text-muted">
          This house number is already recorded in your firm. Ask your Broker Admin to check the existing entry before adding it again.
        </p>
      )}
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link className="font-semibold text-brand-600" href={`/broker/inventory/${encodeURIComponent(item.id)}`} target="_blank" rel="noopener">
            {item.propertyCode}
          </Link>
          <span>{[item.floor, item.unitLabel, surveyPropertyViews[item.view]].filter(Boolean).join(' · ')}</span>
          {item.canReturnToSurvey && (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={reopen.isPending}
              onClick={() => {
                if (window.confirm('Return this existing property to Survey?')) reopen.mutate(item);
              }}
            >
              Return to Survey
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
