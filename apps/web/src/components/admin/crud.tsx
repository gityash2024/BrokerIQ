'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, compressImage, errorMessage, uploadFile } from '@/lib/api';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, img } from '@/lib/utils';
import { PageHeader } from '../panel/shell';
import { PhotoUploader } from '../site/photo-uploader';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Empty, Skeleton, Switch } from '../ui/misc';
import { Sheet } from '../ui/dialog';
import { ApiErrorState } from '../ui/api-error';

export type FieldType = 'text' | 'textarea' | 'richtext' | 'number' | 'switch' | 'select' | 'image' | 'tags' | 'date' | 'json' | 'color' | 'images';
export interface CrudField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  wide?: boolean;
  /** Only shown when creating */
  createOnly?: boolean;
}
export interface CrudColumn {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
  className?: string;
}

const get = (o: any, path: string) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o: any, path: string, v: any) => {
  const keys = path.split('.');
  const out = { ...o };
  let cur = out;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = { ...(cur[k] ?? {}) };
    cur = cur[k];
  });
  cur[keys.at(-1)!] = v;
  return out;
};

export function ImageInput({ value, onChange, kind = 'cms' }: { value: string; onChange: (v: string) => void; kind?: string }) {
  const [busy, setBusy] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const { url } = await uploadFile(await compressImage(f, 1800), kind);
      onChange(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <label className="relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-surface-2 hover:border-brand-400">
        {value ? (
          <img src={img(value, 200)} alt="" className="h-full w-full object-cover" />
        ) : busy ? (
          <Loader2 className="size-5 animate-spin text-brand-600" />
        ) : (
          <ImagePlus className="size-5 text-subtle" />
        )}
        <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="या image URL paste करें" className="text-xs" />
      {value && (
        <button type="button" onClick={() => onChange('')} className="text-subtle hover:text-rose-600" aria-label="Clear">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [t, setT] = useState('');
  const add = () => {
    const v = t.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setT('');
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((x) => (
          <span
            key={x}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
          >
            {x}
            <button type="button" onClick={() => onChange(value.filter((y) => y !== x))} aria-label="Remove">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={t}
          onChange={(e) => setT(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder ?? 'लिखें और Enter दबाएँ'}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

export function FieldInput({ f, value, onChange }: { f: CrudField; value: any; onChange: (v: any) => void }) {
  switch (f.type ?? 'text') {
    case 'textarea':
      return <Textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
    case 'richtext':
      return (
        <Textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? 'Markdown / HTML'}
          className="min-h-72 font-mono text-xs leading-5"
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={f.placeholder}
        />
      );
    case 'switch':
      return (
        <div className="flex h-11 items-center">
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );
    case 'select':
      return (
        <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case 'image':
      return <ImageInput value={value ?? ''} onChange={onChange} />;
    case 'tags':
      return <TagsInput value={value ?? []} onChange={onChange} placeholder={f.placeholder} />;
    case 'date':
      return <Input type="date" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'color':
      return (
        <div className="flex gap-2">
          <input
            type="color"
            value={value || '#4f46e5'}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-surface"
          />
          <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'json':
      return <JsonInput value={value} onChange={onChange} />;
    case 'images':
      return <PhotoUploader value={(value ?? []).map((url: string) => ({ url }))} onChange={(v) => onChange(v.map((p) => p.url))} kind="cms" />;
    default:
      return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
  }
}

function JsonInput({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value || '{}'));
            setErr(null);
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
        className={cn('min-h-40 font-mono text-xs', err && 'border-rose-400')}
      />
      {err && <p className="mt-1 text-xs text-rose-600">Invalid JSON: {err}</p>}
    </div>
  );
}

/** Config-driven list + create/edit sheet for admin master data and CMS entities. */
export function AdminCrud({
  title,
  subtitle,
  endpoint,
  queryKey,
  columns,
  fields,
  defaults = {},
  toBody = (f) => f,
  fromItem = (i) => i,
  loadItem,
  canDelete = true,
  canCreate = true,
  searchKeys = ['name', 'title'],
  serverSearch,
  itemTitle = (i) => i?.name ?? i?.title ?? i?.key,
  headerActions,
  deleteLabel = 'Delete',
}: {
  title: string;
  subtitle?: string;
  endpoint: string;
  queryKey?: string;
  columns: CrudColumn[];
  fields: CrudField[];
  defaults?: Record<string, any>;
  toBody?: (f: any, isNew: boolean) => any;
  fromItem?: (i: any) => any;
  loadItem?: (id: string) => Promise<any>;
  canDelete?: boolean;
  canCreate?: boolean;
  searchKeys?: string[];
  serverSearch?: boolean;
  itemTitle?: (i: any) => string;
  headerActions?: React.ReactNode;
  deleteLabel?: string;
}) {
  const key = queryKey ?? endpoint;
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: [key, serverSearch ? q : ''],
    queryFn: () => api<any>(`${endpoint}${serverSearch && q ? `?q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: (p) => p,
  });
  const rows: any[] = useMemo(() => (Array.isArray(list.data) ? list.data : (list.data?.items ?? [])), [list.data]);
  const filtered = useMemo(
    () =>
      serverSearch || !q
        ? rows
        : rows.filter((r) =>
            searchKeys.some((k) =>
              String(get(r, k) ?? '')
                .toLowerCase()
                .includes(q.toLowerCase()),
            ),
          ),
    [rows, q, serverSearch, searchKeys],
  );
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const isNew = editing && !editing.id;

  const open = async (item: any | null) => {
    if (!item) {
      setForm({ ...defaults });
      setEditing({});
      return;
    }
    setEditing(item);
    if (loadItem) {
      setLoading(true);
      try {
        setForm(fromItem(await loadItem(item.id)));
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setLoading(false);
      }
    } else setForm(fromItem(item));
  };

  const save = useApiMutation(() => (isNew ? post(endpoint, toBody(form, true)) : patch(`${endpoint}/${editing.id}`, toBody(form, false))), {
    success: 'Saved',
    invalidate: [[key]],
    onSuccess: () => setEditing(null),
  });
  const remove = useApiMutation((id: string) => del(`${endpoint}/${id}`), { success: 'Deleted', invalidate: [[key]] });
  const missing = fields.filter((f) => f.required && (form[f.key] === '' || form[f.key] == null)).map((f) => f.label);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {headerActions}
            {canCreate && (
              <Button size="sm" onClick={() => open(null)}>
                <Plus className="size-4" /> नया जोड़ें
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 max-w-sm">
        <Input icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-10" />
      </div>
      {list.isError ? (
        <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : !filtered.length ? (
        <Empty title="कुछ नहीं मिला" text={canCreate ? 'ऊपर "नया जोड़ें" से शुरू करें।' : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold tracking-wide text-subtle uppercase">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cn('px-4 py-3', c.className)}>
                    {c.label}
                  </th>
                ))}
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr
                  key={r.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 20) * 0.015 }}
                  className="border-b border-line last:border-0 hover:bg-surface-2/40"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3', c.className)}>
                      {c.render ? c.render(r) : String(get(r, c.key) ?? '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="icon-sm" variant="ghost" onClick={() => open(r)} aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => confirm(`"${itemTitle(r)}" ${deleteLabel.toLowerCase()} करें?`) && remove.mutate(r.id)}
                        aria-label={deleteLabel}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)} className="max-w-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-line p-5">
            <p className="font-display text-lg font-bold">{isNew ? `नया — ${title}` : itemTitle(editing) || 'Edit'}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <Skeleton className="h-96" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {fields
                  .filter((f) => !f.createOnly || isNew)
                  .map((f) => (
                    <Field
                      key={f.key}
                      label={f.label}
                      required={f.required}
                      hint={f.hint}
                      className={cn((f.wide || ['textarea', 'richtext', 'image', 'images', 'tags', 'json'].includes(f.type ?? '')) && 'sm:col-span-2')}
                    >
                      <FieldInput f={f} value={get(form, f.key)} onChange={(v) => setForm((x: any) => set(x, f.key, v))} />
                    </Field>
                  ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-line p-4">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate(undefined)}
              loading={save.isPending}
              disabled={missing.length > 0 || loading}
              title={missing.length ? `ज़रूरी: ${missing.join(', ')}` : undefined}
            >
              Save
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total?: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return total != null ? <p className="mt-3 text-right text-xs text-subtle">{total} results</p> : null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <span className="text-muted">
        {total != null && `${total} · `}Page {page} / {totalPages}
      </span>
      <Button size="xs" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </Button>
      <Button size="xs" variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}
