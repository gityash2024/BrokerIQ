import { Button } from '@/components/ui/button';

export function InventoryStatusActions({ itemId, disabled = false }: { itemId: string; disabled?: boolean }) {
  const route = `/broker/inventory/${encodeURIComponent(itemId)}/edit`;
  return (
    <div className="flex flex-wrap gap-2">
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
