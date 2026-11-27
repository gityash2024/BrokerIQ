'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { clientBedroomChoices, clientRequirementFilterSchema, emptyClientRequirementFilters, type ClientRequirementFilterDraft } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/field';

export function ClientRequirementFilters({
  value,
  onApply,
}: {
  value: ClientRequirementFilterDraft;
  onApply: (filters: ClientRequirementFilterDraft) => void;
}) {
  const [draft, setDraft] = useState<ClientRequirementFilterDraft | null>(null);
  const count = Object.values(value).filter(Boolean).length;
  const validation = draft === null ? null : clientRequirementFilterSchema.safeParse(draft);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => setDraft(value)}>
        <Filter className="size-4" /> BHK &amp; budget{count ? ` (${count})` : ''}
      </Button>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title="BHK and budget filters"
      >
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!validation?.success) return;
              onApply(draft);
              setDraft(null);
            }}
          >
            <label className="block text-sm">
              BHK
              <Select value={draft.bedrooms} onChange={(event) => setDraft({ ...draft, bedrooms: event.target.value })}>
                <option value="">Any BHK</option>
                {clientBedroomChoices.map((rooms) => (
                  <option key={rooms} value={rooms}>
                    {rooms} BHK
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Minimum budget (₹)
                <Input type="number" min={0} step="0.01" value={draft.minBudget} onChange={(event) => setDraft({ ...draft, minBudget: event.target.value })} />
              </label>
              <label className="text-sm">
                Maximum budget (₹)
                <Input type="number" min={0} step="0.01" value={draft.maxBudget} onChange={(event) => setDraft({ ...draft, maxBudget: event.target.value })} />
              </label>
            </div>
            {validation && !validation.success && (
              <p role="alert" className="text-sm text-rose-600">
                {validation.error.issues[0].message}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(emptyClientRequirementFilters)}>
                Reset
              </Button>
              <Button type="submit" disabled={!validation?.success}>
                Apply filters
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
