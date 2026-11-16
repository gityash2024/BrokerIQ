import Link from 'next/link';

export function InventoryStatusActions({ itemId }: { itemId: string }) {
  const route = `/broker/inventory/${encodeURIComponent(itemId)}/edit`;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
      <Link className="text-brand-600 hover:underline" href={route + '?makeAvailable=1'}>
        Make available
      </Link>
      <Link className="text-muted hover:text-fg hover:underline" href={route + '?makeRented=1'}>
        Mark rented out
      </Link>
    </div>
  );
}
