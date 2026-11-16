'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InventoryWorkspace } from '@/components/broker/launch/inventory-workspace';
import { InventoryFoldersPage } from '@/components/broker/launch/inventory-folders';

function InventoryPage() {
  const params = useSearchParams();
  return params.size ? <InventoryWorkspace /> : <InventoryFoldersPage />;
}

export default function Inventory() {
  return (
    <Suspense>
      <InventoryPage />
    </Suspense>
  );
}
