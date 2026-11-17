'use client';

import { useRouter } from 'next/navigation';
import type { LedgerItem } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';

export function InventoryStatusActions({ item, disabled = false }: { item: Pick<LedgerItem, 'id' | 'availability'>; disabled?: boolean }) {
  const router = useRouter();
  const active = item.availability === 'AVAILABLE';
  const route = `/broker/inventory/${encodeURIComponent(item.id)}/edit`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AvailabilitySwitch
        active={active}
        label={active ? 'Mark property rented out' : 'Make property available'}
        disabled={disabled}
        onToggle={() => router.push(route + (active ? '?makeRented=1' : '?makeAvailable=1'))}
      />
      <Button
        size="sm"
        variant="secondary"
        href={route + '?makeAvailable=1'}
        disabled={disabled}
        title={disabled ? 'Inventory edit access required' : undefined}
      >
        Make available
      </Button>
      <Button size="sm" variant="secondary" href={route + '?makeRented=1'} disabled={disabled} title={disabled ? 'Inventory edit access required' : undefined}>
        Mark rented out
      </Button>
    </div>
  );
}

export function AvailabilitySwitch({ active, label, disabled, onToggle }: { active: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="grid h-11 min-w-14 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
    >
      <span className="relative h-8 w-14 rounded-lg border border-line bg-surface-2 shadow-inner">
        <span className={`absolute top-1 h-6 w-6 rounded-md shadow-sm transition-all ${active ? 'left-1 bg-brand-600' : 'left-7 bg-surface'}`} />
      </span>
    </button>
  );
}
