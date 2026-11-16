'use client';

import { MAX_VISIT_PROPERTIES, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { VisitPropertyPicker } from './visit-property-picker';

export function VisitProperties({ items, onChange }: { items: LedgerItem[]; onChange: (items: LedgerItem[]) => void }) {
  return (
    <section className="space-y-3" aria-label="Visit properties">
      <p className="text-sm font-semibold">
        Properties · {items.length}/{MAX_VISIT_PROPERTIES}
      </p>
      {items.length > 0 && (
        <ol className="list-decimal space-y-2 pl-6">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{visitInventoryTitle(item)}</span>
                <Button type="button" size="xs" variant="ghost" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {items.length < MAX_VISIT_PROPERTIES && (
        <VisitPropertyPicker
          excluded={items.map((item) => item.id)}
          value={null}
          onChange={(item) => {
            if (item && !items.some((entry) => entry.id === item.id)) onChange([...items, item]);
          }}
        />
      )}
    </section>
  );
}
