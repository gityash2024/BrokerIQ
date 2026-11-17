'use client';
import { LoadingArtwork } from '@/components/ui/request-loader';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { hasDelegatedAccess, inventoryFolderDefaults, inventoryMonth, inventoryMonthSchema, inventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { InventoryWhatsAppDialog } from '@/components/broker/inventory-whatsapp-dialog';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { InventoryDetails } from './inventory-details';
import { PropertyForm } from './property-form';
import { PublicPublish } from './public-publish';

type Mode = 'new' | 'edit' | 'detail' | 'publish';

export function InventoryRecordPage({ base, mode }: { base: '/broker/inventory' | '/admin/inventory'; mode: Mode }) {
  return (
    <Suspense>
      <RecordContent base={base} mode={mode} />
    </Suspense>
  );
}

function RecordContent({ base, mode }: { base: string; mode: Mode }) {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const organizationId = search.get('organizationId') || '';
  const makeRented = mode === 'edit' && search.get('makeRented') === '1';
  const makeAvailable = !makeRented && (search.get('makeAvailable') === '1' || (mode === 'new' && base === '/broker/inventory'));
  const requestedMonth = inventoryMonthSchema.safeParse(search.get('directoryMonth'));
  const folderMonth = requestedMonth.success ? requestedMonth.data : inventoryMonth();
  const defaults = inventoryFolderDefaults(search.get('folderRoom'), search.get('furnishing'));
  const superAdmin = user?.role === 'SUPER_ADMIN';
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const allowed =
    !delegated ||
    (mode === 'detail'
      ? hasDelegatedAccess(user, 'inventory', 'view')
      : mode === 'new'
        ? hasDelegatedAccess(user, 'inventory', 'create')
        : mode === 'edit'
          ? hasDelegatedAccess(user, 'inventory', 'view', 'edit')
          : hasDelegatedAccess(user, 'inventory', 'publish') || hasDelegatedAccess(user, 'inventory', 'approve'));
  const detail = id ? `${base}/${encodeURIComponent(id)}` : base;
  const back = mode === 'edit' || mode === 'publish' ? detail : base;
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(false);
  const [changing, setChanging] = useState(false);
  const key = ['ledger-item', user?.id, id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<LedgerItem>(`/inventory/${encodeURIComponent(id)}`),
    enabled: !!user && !!id && allowed,
  });
  const item = query.data;
  const title =
    mode === 'new'
      ? 'Add property'
      : mode === 'edit'
        ? makeAvailable
          ? 'Review property availability'
          : 'Edit property'
        : mode === 'publish'
          ? 'Publish / review property'
          : item
            ? inventoryTitle(item)
            : 'Property details';

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  async function refresh() {
    await Promise.all(
      [
        'ledger-item',
        'ledger',
        'ledger-stats',
        'ledger-sectors',
        'inventory-folders',
        'inventory-folder-items',
        'broker-dashboard',
        'enterprise-dashboard',
      ].map((prefix) => client.invalidateQueries({ queryKey: [prefix] })),
    );
  }

  async function archive(restore = false) {
    if (!item || changing || (!restore && !window.confirm('Archive this private property? Any public listing will be withdrawn.'))) return;
    setChanging(true);
    try {
      await api(restore ? `/inventory/${item.id}/restore` : `/inventory/${item.id}`, { method: restore ? 'POST' : 'DELETE' });
      await refresh();
      router.replace(base);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        actions={
          <Button
            variant="secondary"
            href={back}
            onClick={(event) => {
              if (dirty && !window.confirm('Discard unsaved property changes?')) event.preventDefault();
            }}
          >
            <ArrowLeft className="size-4" /> {back === base ? 'Inventory' : 'Property details'}
          </Button>
        }
      />
      {!allowed ? (
        <p role="alert">This action is not assigned to your account.</p>
      ) : query.error ? (
        <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {mode !== 'new' && !item && <LoadingArtwork className="h-16" label="Loading property…" />}
          {(mode === 'new' || (mode === 'edit' && item && !item.deletedAt)) &&
            (superAdmin && mode === 'new' && !organizationId ? (
              <p role="alert">Choose a firm in Inventory before adding a property.</p>
            ) : (
              <section className="card mx-auto max-w-5xl p-4 sm:p-6">
                {item?.sourceEntry && (
                  <div className="mb-5 rounded-xl bg-surface-2 p-4">
                    {superAdmin || !item.sourceEntry.batch ? (
                      <p className="font-semibold">Source · Page {item.pageNo ?? '—'}</p>
                    ) : (
                      <Link href={`/broker/imports/${item.sourceEntry.batch.id}`} className="font-semibold text-brand-600">
                        View source · Page {item.pageNo ?? '—'}
                      </Link>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{item.sourceEntry.rawText}</p>
                  </div>
                )}
                <PropertyForm
                  key={item?.id ?? organizationId}
                  initial={item ?? (superAdmin ? { organizationId } : makeAvailable ? { purpose: 'RENT', ...defaults } : {})}
                  activateInMonth={makeAvailable ? (item?.availability === 'AVAILABLE' ? (item.directoryMonth ?? folderMonth) : folderMonth) : undefined}
                  markRented={makeRented}
                  requireAvailability={mode === 'edit' && makeAvailable}
                  label={makeRented ? 'Save as rented out' : mode === 'edit' && makeAvailable ? 'Confirm availability' : undefined}
                  onDirty={() => setDirty(true)}
                  onSave={async (input) => {
                    const created = await api<LedgerItem>(item ? `/inventory/${item.id}` : '/inventory', {
                      method: item ? 'PATCH' : 'POST',
                      body: !item && superAdmin ? { ...input, organizationId } : input,
                    });
                    setDirty(false);
                    await refresh();
                    router.replace(`${base}/${encodeURIComponent(created.id)}`);
                  }}
                />
              </section>
            ))}
          {item && mode === 'detail' && (
            <div className="mx-auto max-w-5xl">
              <InventoryDetails
                item={item}
                sourceHref={superAdmin ? null : undefined}
                onEdit={!delegated || hasDelegatedAccess(user, 'inventory', 'edit') ? () => router.push(`${detail}/edit`) : undefined}
                onPublish={
                  !delegated || hasDelegatedAccess(user, 'inventory', 'publish') || hasDelegatedAccess(user, 'inventory', 'approve')
                    ? () => router.push(`${detail}/publish`)
                    : undefined
                }
                onMessage={() => setMessage(true)}
                onArchive={!changing && (!delegated || hasDelegatedAccess(user, 'inventory', 'delete')) ? () => void archive() : undefined}
                onRestore={!changing && (superAdmin || user?.role === 'BROKER_ADMIN') ? () => void archive(true) : undefined}
                onUploadPhoto={
                  !delegated || hasDelegatedAccess(user, 'inventory', 'edit')
                    ? async (url) => {
                        const updated = await api<LedgerItem>(`/inventory/${item.id}/photos`, {
                          method: 'PATCH',
                          ownerContext: captureAccountContext(),
                          body: { url },
                        });
                        client.setQueryData(key, updated);
                        await refresh();
                      }
                    : undefined
                }
              />
              <InventoryWhatsAppDialog
                open={message}
                onOpenChange={setMessage}
                item={item}
                brokerName={user?.name}
                brokerFirm={item.organization?.name ?? user?.organization?.name ?? ''}
              />
            </div>
          )}
          {item && mode === 'publish' && !item.deletedAt && (
            <section className="card mx-auto max-w-4xl p-4 sm:p-6">
              <PublicPublish
                item={item}
                onDone={() => {
                  void refresh();
                  toast.success('Publication saved; status follows the required review path');
                  router.replace(detail);
                }}
              />
            </section>
          )}
          {item?.deletedAt && mode !== 'detail' && <p role="alert">Restore this property before editing or publishing it.</p>}
        </>
      )}
    </div>
  );
}
