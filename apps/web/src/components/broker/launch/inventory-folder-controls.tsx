'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type InventoryFolderDefinition } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

const endpoint = '/inventory/folder-definitions';

export function useInventoryFolderDefinitions(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-folder-definitions', user?.organization?.id, user?.id],
    queryFn: () => api<InventoryFolderDefinition[]>(endpoint),
    enabled: enabled && !!user?.organization?.id && hasDelegatedAccess(user, 'inventory', 'view'),
  });
}

export function InventoryFolderControls({ onCreated, sectorsOnly = false }: {
  onCreated: (folder: InventoryFolderDefinition) => void;
  sectorsOnly?: boolean;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [kind, setKind] = useState<'SECTOR' | 'CUSTOM' | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user?.organization?.id || !hasDelegatedAccess(user, 'inventory', 'view', 'create')) return null;

  function open(next: 'SECTOR' | 'CUSTOM') {
    setLabel('');
    setKind(next);
  }

  async function save() {
    if (!kind || !label.trim() || busy) return;
    setBusy(true);
    try {
      const folder = await api<InventoryFolderDefinition>(endpoint, { method: 'POST', body: { kind, label } });
      void cache.invalidateQueries({ predicate: ({ queryKey }) => /^(inventory-folder|ledger-sectors)/.test(String(queryKey[0])) });
      onCreated(folder);
      setKind(null);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => open('SECTOR')}>Create sector folder</Button>
      {!sectorsOnly && <Button type="button" size="sm" variant="secondary" onClick={() => open('CUSTOM')}>Create folder</Button>}
      <Dialog open={!!kind} onOpenChange={(shown) => { if (!shown && !busy) setKind(null); }}
        title={kind === 'SECTOR' ? 'Create sector folder' : 'Create folder'}
        footer={<Button type="button" onClick={() => void save()} disabled={busy || !label.trim()}>Create</Button>}>
        <label className="block text-sm">Folder name
          <input className="mt-1 w-full rounded-xl border border-line bg-surface p-2" maxLength={100} value={label}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }}
            onChange={(event) => setLabel(event.target.value)} placeholder={kind === 'SECTOR' ? 'Sector 30' : undefined} />
        </label>
      </Dialog>
    </div>
  );
}
