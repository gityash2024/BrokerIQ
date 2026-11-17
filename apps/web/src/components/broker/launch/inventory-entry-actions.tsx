'use client';

import { hasDelegatedAccess, moduleAllowed } from '@brokeriq/shared';
import { Camera, FileArchive, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';

export function InventoryEntryActions({ createHref }: { createHref: string }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const canCreate = !!user && hasDelegatedAccess(user, 'inventory', 'create');
  const canImport = canCreate && moduleAllowed(modules, 'inbox', role) && hasDelegatedAccess(user, 'inbox', 'view', 'create');
  return (
    <div className="flex flex-wrap gap-2" aria-label="Inventory entry actions">
      <Button href={createHref} disabled={!canCreate} title={!canCreate ? 'Ask your Broker Admin for inventory create access' : undefined}>
        <Plus className="size-4" /> Add property
      </Button>
      <Button
        href="/broker/scanner?target=INVENTORY"
        variant="secondary"
        disabled={!canImport}
        title={!canImport ? 'Inventory create and capture access required' : undefined}
      >
        <Camera className="size-4" /> Scan property
      </Button>
      <Button
        href="/broker/imports?target=INVENTORY"
        variant="secondary"
        disabled={!canImport}
        title={!canImport ? 'Inventory create and capture access required' : undefined}
      >
        <FileArchive className="size-4" /> WhatsApp import
      </Button>
      {!canImport && <p className="basis-full text-xs text-muted">Ask your Broker Admin for inventory create and capture access to use these actions.</p>}
    </div>
  );
}
