'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as DM from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import {
  Ban,
  CheckCircle2,
  Crown,
  Eye,
  KeyRound,
  LogOut,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Trash2,
  UserCog,
} from 'lucide-react';
import { LISTING_STATUS_LABELS, USER_RESTRICTIONS, timeAgo, type ListingStatus } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '../ui/button';
import { Dialog, Sheet } from '../ui/dialog';
import { Input, Textarea } from '../ui/field';
import { Avatar, Badge, Skeleton } from '../ui/misc';

// ------------------------------------------------------------------ small building blocks
const itemCls = 'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-2';
const dangerCls = 'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 outline-none hover:bg-rose-50 dark:hover:bg-rose-500/10';

export function ActionsMenu({ children, label = 'Actions' }: { children: React.ReactNode; label?: string }) {
  return (
    <DM.Root>
      <DM.Trigger className="rounded-lg p-2 text-subtle hover:bg-surface-2" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <MoreHorizontal className="size-4" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" className="z-50 min-w-56 rounded-xl border border-line bg-surface p-1 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MenuItem({ onSelect, danger, children }: { onSelect: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <DM.Item onSelect={onSelect} className={danger ? dangerCls : itemCls}>
      {children}
    </DM.Item>
  );
}

/** Asks for a reason (shown to the affected person and kept in the audit log). */
export function ReasonDialog({
  open,
  title,
  confirmLabel = 'Confirm',
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (!v && onClose(), setReason(''))}
      title={title}
      description="कारण लिखें — यह उस व्यक्ति को बताया जाएगा और audit log में रहेगा।"
      footer={
        <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
          {confirmLabel}
        </Button>
      }
    >
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="जैसे: fake photos, गलत rent, spam, शिकायतें…" />
    </Dialog>
  );
}

/** Pick which single abilities are switched off (post, chat, ai…). */
export function RestrictionsDialog({
  open,
  title,
  options,
  value,
  onClose,
  onSave,
  busy,
}: {
  open: boolean;
  title: string;
  options: Record<string, string>;
  value: string[];
  onClose: () => void;
  onSave: (v: string[]) => void;
  busy?: boolean;
}) {
  const [sel, setSel] = useState<string[]>(value);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setSel(value) : onClose())}
      title={title}
      description="चुनी हुई सुविधाएँ बंद होंगी; बाकी account पहले जैसा चलेगा।"
      footer={
        <Button loading={busy} onClick={() => onSave(sel)}>
          Save
        </Button>
      }
    >
      <div className="space-y-2">
        {Object.entries(options).map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-rose-600"
              checked={sel.includes(k)}
              onChange={(e) => setSel(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k))}
            />
            <span className="flex-1">{label} बंद</span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ users
const ROLE_OPTIONS = [
  ['USER', 'User (normal)'],
  ['MODERATOR', 'Moderator — listings, reviews, reports'],
  ['SUPPORT', 'Support — users देखना, logout, password reset'],
  ['SUPER_ADMIN', 'Super Admin — पूरा access'],
] as const;

/** Row menu for a user: block/unblock, logout everywhere, reset password, restrictions, role, delete, details. */
export function UserActions({ u, onOpen }: { u: any; onOpen?: () => void }) {
  const { user: me } = useAuth();
  const isSuper = me?.role === 'SUPER_ADMIN';
  const inv = [['admin-users'], ['admin-user', u.id]];
  const [dialog, setDialog] = useState<null | 'block' | 'restrict' | 'role' | 'delete'>(null);
  const block = useApiMutation((reason: string) => post(`/admin/users/${u.id}/block`, { reason }), {
    success: 'User block हो गया',
    invalidate: inv,
    onSuccess: () => setDialog(null),
  });
  const unblock = useApiMutation(() => post(`/admin/users/${u.id}/unblock`, {}), { success: 'User फिर से चालू', invalidate: inv });
  const logout = useApiMutation(() => post(`/admin/users/${u.id}/logout`, {}), { success: 'सभी devices से logout कर दिया' });
  const reset = useApiMutation(() => post<any>(`/admin/users/${u.id}/password-reset`, {}), { success: (r: any) => `Reset code भेजा: ${r.email}` });
  const restrict = useApiMutation((restrictions: string[]) => patch(`/admin/users/${u.id}/restrictions`, { restrictions }), {
    success: 'Restrictions saved',
    invalidate: inv,
    onSuccess: () => setDialog(null),
  });
  const role = useApiMutation((r: string) => patch(`/admin/users/${u.id}`, { role: r }), {
    success: 'Role बदल गया',
    invalidate: inv,
    onSuccess: () => setDialog(null),
  });
  const remove = useApiMutation(() => del(`/admin/users/${u.id}`), { success: 'Account delete हो गया', invalidate: inv, onSuccess: () => setDialog(null) });
  const [confirmText, setConfirmText] = useState('');
  if (u.id === me?.id) return null;
  const blocked = u.status === 'SUSPENDED';
  return (
    <>
      <ActionsMenu>
        {onOpen && (
          <MenuItem onSelect={onOpen}>
            <Eye className="size-4" /> Details
          </MenuItem>
        )}
        {blocked ? (
          <MenuItem onSelect={() => unblock.mutate()}>
            <CheckCircle2 className="size-4" /> Unblock
          </MenuItem>
        ) : (
          <MenuItem onSelect={() => setDialog('block')} danger>
            <Ban className="size-4" /> Block (कारण के साथ)
          </MenuItem>
        )}
        <MenuItem onSelect={() => logout.mutate()}>
          <LogOut className="size-4" /> सभी devices से logout
        </MenuItem>
        {(isSuper || me?.role === 'SUPPORT') && (
          <MenuItem onSelect={() => reset.mutate()}>
            <KeyRound className="size-4" /> Password reset code भेजें
          </MenuItem>
        )}
        {me?.role !== 'SUPPORT' && (
          <MenuItem onSelect={() => setDialog('restrict')}>
            <SlidersHorizontal className="size-4" /> Restrictions{u.restrictions?.length ? ` (${u.restrictions.length})` : ''}
          </MenuItem>
        )}
        {isSuper && !u.organization && (
          <MenuItem onSelect={() => setDialog('role')}>
            <UserCog className="size-4" /> Role / team access
          </MenuItem>
        )}
        {isSuper && u.role !== 'SUPER_ADMIN' && (
          <MenuItem onSelect={() => (setConfirmText(''), setDialog('delete'))} danger>
            <Trash2 className="size-4" /> Account delete
          </MenuItem>
        )}
      </ActionsMenu>

      <ReasonDialog
        open={dialog === 'block'}
        title={`${u.name} को block करें?`}
        confirmLabel="Block करें"
        busy={block.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(r) => block.mutate(r)}
      />
      <RestrictionsDialog
        open={dialog === 'restrict'}
        title={`${u.name} — restrictions`}
        options={USER_RESTRICTIONS}
        value={u.restrictions ?? []}
        busy={restrict.isPending}
        onClose={() => setDialog(null)}
        onSave={(v) => restrict.mutate(v)}
      />
      <Dialog
        open={dialog === 'role'}
        onOpenChange={(v) => !v && setDialog(null)}
        title={`${u.name} — role`}
        description="BrokerIQ team के लोगों को सिर्फ़ ज़रूरी access दें।"
      >
        <div className="space-y-2">
          {ROLE_OPTIONS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => role.mutate(k)}
              disabled={role.isPending}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition',
                u.role === k ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-line hover:border-brand-300',
              )}
            >
              {k === 'SUPER_ADMIN' ? (
                <Crown className="size-4 text-rose-500" />
              ) : k === 'USER' ? (
                <ShieldOff className="size-4" />
              ) : (
                <ShieldCheck className="size-4 text-brand-600" />
              )}
              <span className="flex-1">{label}</span>
            </button>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'delete'}
        onOpenChange={(v) => !v && setDialog(null)}
        title={`${u.name} का account delete करें?`}
        description='Profile, saved items, requirements, location/contacts और documents हट जाएँगे — वापस नहीं होगा। पक्का करने के लिए "DELETE" लिखें।'
        footer={
          <Button variant="danger" loading={remove.isPending} disabled={confirmText.trim().toUpperCase() !== 'DELETE'} onClick={() => remove.mutate()}>
            Delete
          </Button>
        }
      >
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" data-no-i18n />
      </Dialog>
    </>
  );
}

/** Everything about one user on one page: status, restrictions, listings, enquiries, sessions. */
export function UserSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin-user', id], queryFn: () => api<any>(`/admin/users/${id}`), enabled: !!id });
  const d = q.data;
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()} className="max-w-xl">
      {!d ? (
        <Skeleton className="m-5 h-96" />
      ) : (
        <div className="h-full overflow-y-auto p-6">
          <div className="flex items-center gap-4">
            <Avatar name={d.user.name} src={d.user.avatarUrl} size={56} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold" data-no-i18n>
                {d.user.name}
              </p>
              <p className="truncate text-sm text-muted" data-no-i18n>
                {d.user.email}
                {d.user.phone ? ` · ${d.user.phone}` : ''}
              </p>
            </div>
            <UserActions u={d.user} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={d.user.status === 'ACTIVE' ? 'success' : 'danger'}>{d.user.status}</Badge>
            <Badge>{d.user.role.replace('_', ' ')}</Badge>
            {d.user.organization && <Badge tone="brand">{d.user.organization.name}</Badge>}
            {d.user.tenantVerifiedAt && <Badge tone="success">Verified tenant</Badge>}
            {(d.user.restrictions ?? []).map((r: string) => (
              <Badge key={r} tone="warning">
                {(USER_RESTRICTIONS as Record<string, string>)[r] ?? r} बंद
              </Badge>
            ))}
          </div>
          {d.user.blockedReason && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              Block कारण: {d.user.blockedReason}
            </p>
          )}
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              ['Listings', d.listings.length],
              ['Enquiries', d.enquiries.length],
              ['Reports', d.counts.reports],
              ['Sessions', d.counts.activeSessions],
            ].map(([l, n]) => (
              <div key={l} className="rounded-xl bg-surface-2 p-3">
                <p className="font-display text-xl font-extrabold">{n}</p>
                <p className="text-xs text-muted">{l}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Joined {formatDate(d.user.createdAt)} · Last login {d.user.lastLoginAt ? timeAgo(d.user.lastLoginAt) : '—'}
            {d.recentLogins[0]?.ip ? ` · IP ${d.recentLogins[0].ip}` : ''}
          </p>
          {d.listings.length > 0 && (
            <>
              <p className="mt-6 mb-2 font-semibold">Listings</p>
              <div className="divide-y divide-line rounded-2xl border border-line text-sm">
                {d.listings.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-2 px-3 py-2">
                    <Link href={`/property/${l.slug}`} target="_blank" className="min-w-0 flex-1 truncate hover:text-brand-600" data-no-i18n>
                      {l.title}
                    </Link>
                    <Badge>{l.deletedAt ? 'Deleted' : (LISTING_STATUS_LABELS[l.status as ListingStatus] ?? l.status)}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
          {d.enquiries.length > 0 && (
            <>
              <p className="mt-6 mb-2 font-semibold">Enquiries</p>
              <div className="space-y-1 text-sm">
                {d.enquiries.map((e: any) => (
                  <p key={e.id} className="truncate text-muted">
                    {formatDate(e.createdAt)} · <span data-no-i18n>{e.listing?.title ?? '—'}</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ listings
/** Row menu for a listing: block/unblock, set status, delete/restore. */
export function ListingActions({ l, onChanged }: { l: any; onChanged?: () => void }) {
  const inv = [['admin-listings'], ['admin-moderation']];
  const [blockOpen, setBlockOpen] = useState(false);
  const opts = { invalidate: inv, onSuccess: () => onChanged?.() };
  const block = useApiMutation((reason: string) => post(`/admin/listings/${l.id}/block`, { reason }), {
    ...opts,
    success: 'Listing block हो गई',
    onSuccess: () => (setBlockOpen(false), onChanged?.()),
  });
  const unblock = useApiMutation(() => post(`/admin/listings/${l.id}/unblock`, {}), { ...opts, success: 'Listing वापस चालू' });
  const status = useApiMutation((s: string) => post(`/admin/listings/${l.id}/status`, { status: s }), { ...opts, success: 'Status बदल गया' });
  const remove = useApiMutation(() => del(`/admin/listings/${l.id}`), { ...opts, success: 'Listing delete हो गई' });
  const restore = useApiMutation(() => post(`/admin/listings/${l.id}/restore`, {}), { ...opts, success: 'Listing restore हो गई' });
  return (
    <>
      <ActionsMenu>
        {l.deletedAt ? (
          <MenuItem onSelect={() => restore.mutate()}>
            <RotateCcw className="size-4" /> Restore
          </MenuItem>
        ) : (
          <>
            {l.status === 'BLOCKED' ? (
              <MenuItem onSelect={() => unblock.mutate()}>
                <CheckCircle2 className="size-4" /> Unblock
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => setBlockOpen(true)} danger>
                <Ban className="size-4" /> Block (कारण के साथ)
              </MenuItem>
            )}
            {(['ACTIVE', 'RENTED', 'EXPIRED', 'ARCHIVED'] as const)
              .filter((s) => s !== l.status)
              .map((s) => (
                <MenuItem key={s} onSelect={() => status.mutate(s)}>
                  → {LISTING_STATUS_LABELS[s]}
                </MenuItem>
              ))}
            <MenuItem onSelect={() => confirm('Listing delete करें? (restore हो सकती है)') && remove.mutate()} danger>
              <Trash2 className="size-4" /> Delete
            </MenuItem>
          </>
        )}
      </ActionsMenu>
      <ReasonDialog
        open={blockOpen}
        title={`Block: ${l.title}`}
        confirmLabel="Block करें"
        busy={block.isPending}
        onClose={() => setBlockOpen(false)}
        onConfirm={(r) => block.mutate(r)}
      />
    </>
  );
}

/** Bulk bar for selected listings. */
export function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [reasonFor, setReasonFor] = useState<null | 'block' | 'reject'>(null);
  const run = useApiMutation((b: { action: string; reason?: string }) => post<any>('/admin/listings/bulk', { ids, ...b }), {
    invalidate: [['admin-listings'], ['admin-moderation']],
    onSuccess: (r: any) => {
      toast.success(`${r.done} listings updated${r.failed.length ? ` · ${r.failed.length} failed` : ''}`);
      setReasonFor(null);
      onDone();
    },
  });
  if (!ids.length) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-xl">
      <span className="px-2 text-sm font-semibold">{ids.length} चुनी</span>
      <Button size="sm" variant="danger" onClick={() => setReasonFor('block')}>
        Block
      </Button>
      <Button size="sm" variant="secondary" onClick={() => run.mutate({ action: 'unblock' })}>
        Unblock
      </Button>
      <Button size="sm" variant="success" onClick={() => run.mutate({ action: 'approve' })}>
        Approve / Live
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setReasonFor('reject')}>
        Reject
      </Button>
      <Button size="sm" variant="secondary" onClick={() => run.mutate({ action: 'verify' })}>
        Verify
      </Button>
      <Button size="sm" variant="secondary" onClick={() => run.mutate({ action: 'feature' })}>
        Feature
      </Button>
      <Button size="sm" variant="ghost" onClick={() => confirm(`${ids.length} listings delete करें?`) && run.mutate({ action: 'delete' })}>
        Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Clear
      </Button>
      <ReasonDialog
        open={!!reasonFor}
        title={`${ids.length} listings ${reasonFor === 'block' ? 'block' : 'reject'} करें`}
        confirmLabel="Confirm"
        busy={run.isPending}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) => run.mutate({ action: reasonFor!, reason })}
      />
    </div>
  );
}
