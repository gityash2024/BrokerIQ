'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Reorder } from 'motion/react';
import { toast } from 'sonner';
import { ExternalLink, GripVertical, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { FieldInput } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge, Skeleton, Switch } from '@/components/ui/misc';
import { Dialog, Sheet } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

const TYPES: Record<string, { label: string; help: string; sample: Record<string, unknown> }> = {
  HERO: { label: 'Hero (search)', help: 'backgroundUrl, stats', sample: { backgroundUrl: '' } },
  LOCALITIES: { label: 'Popular localities', help: 'limit, popularOnly', sample: { limit: 12, popularOnly: true } },
  FEATURED_LISTINGS: { label: 'Featured listings', help: 'limit, purpose (SALE/RENT)', sample: { limit: 8 } },
  MAP_EXPLORER: { label: 'Map explorer', help: '—', sample: {} },
  FEATURED_PROJECTS: { label: 'New projects (sponsored)', help: 'limit', sample: { limit: 6 } },
  TOP_BROKERS: { label: 'Top brokers', help: 'limit', sample: { limit: 8 } },
  TOOLS: { label: 'Calculators strip', help: '—', sample: {} },
  WHY_US: { label: 'Why us', help: 'items: [{icon,title,text}]', sample: { items: [{ icon: 'shield-check', title: 'Verified', text: '' }] } },
  APP_DOWNLOAD: { label: 'App download', help: 'Play/App store links App config से', sample: {} },
  BLOG: { label: 'Blog', help: 'limit', sample: { limit: 3 } },
  CTA_BANNER: { label: 'CTA banner', help: 'ctaLabel, ctaLink', sample: { ctaLabel: 'Start now', ctaLink: '/for-brokers' } },
  TESTIMONIALS: { label: 'Testimonials', help: 'items: [{name,role,text,avatarUrl}]', sample: { items: [{ name: '', role: '', text: '' }] } },
  BANNER: { label: 'Image banner / sponsored ad', help: 'imageUrl, link, sponsor', sample: { imageUrl: '', link: '', sponsor: '' } },
};

export default function HomepageBuilder() {
  const q = useQuery({ queryKey: ['admin-homepage'], queryFn: () => api<any[]>('/admin/homepage') });
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [add, setAdd] = useState(false);
  const [newType, setNewType] = useState('BANNER');
  useEffect(() => {
    if (q.data) setItems(q.data);
  }, [q.data]);
  const inv = [['admin-homepage']];
  const toggle = useApiMutation((s: any) => patch(`/admin/homepage/${s.id}`, { isActive: !s.isActive }), { invalidate: inv });
  const remove = useApiMutation((id: string) => del(`/admin/homepage/${id}`), { success: 'Section हटाया', invalidate: inv });
  const create = useApiMutation(() => post('/admin/homepage', { type: newType, title: TYPES[newType]?.label ?? newType, subtitle: '', isActive: false, config: TYPES[newType]?.sample ?? {} }), { success: 'Section जुड़ा (inactive) — edit करके चालू करें', invalidate: inv, onSuccess: () => setAdd(false) });
  const saveOrder = async (next: any[]) => {
    try {
      await api('/admin/homepage/order', { method: 'PUT', body: { ids: next.map((s) => s.id) } });
      toast.success('Order saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader
        title="Homepage builder"
        subtitle="Website और app के home screen के sections — drag करके order बदलें, on/off करें, content edit करें"
        actions={
          <>
            <Button size="sm" variant="secondary" href="/" external>Preview <ExternalLink className="size-3.5" /></Button>
            <Button size="sm" onClick={() => setAdd(true)}><Plus className="size-4" /> Section</Button>
          </>
        }
      />
      {q.isError ? <ApiErrorState error={q.error} /> : !q.data ? <Skeleton className="h-96 rounded-2xl" /> : (
        <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
          {items.map((s, i) => (
            <Reorder.Item key={s.id} value={s} onDragEnd={() => saveOrder(items)} className={cn('card flex cursor-grab items-center gap-3 p-4 active:cursor-grabbing', !s.isActive && 'opacity-60')}>
              <GripVertical className="size-5 text-subtle" />
              <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title || TYPES[s.type]?.label || s.type}</p>
                <p className="line-clamp-1 text-xs text-muted">{s.subtitle || '—'}</p>
              </div>
              <Badge>{TYPES[s.type]?.label ?? s.type}</Badge>
              <Button size="icon-sm" variant="ghost" onClick={() => setEdit(s)} aria-label="Edit"><Pencil className="size-4" /></Button>
              <Button size="icon-sm" variant="ghost" onClick={() => confirm('Section हटाएँ?') && remove.mutate(s.id)} aria-label="Delete"><Trash2 className="size-4" /></Button>
              <Switch checked={s.isActive} onCheckedChange={() => toggle.mutate(s)} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
      <SectionEditor section={edit} onClose={() => setEdit(null)} />
      <Dialog open={add} onOpenChange={setAdd} title="नया section" footer={<Button onClick={() => create.mutate(undefined)} loading={create.isPending}>Add</Button>}>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(TYPES).map(([k, t]) => (
            <button key={k} onClick={() => setNewType(k)} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium', newType === k ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15' : 'border-line hover:bg-surface-2')}>
              <LayoutTemplate className="size-4" /> {t.label}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}

function SectionEditor({ section, onClose }: { section: any; onClose: () => void }) {
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (section) setF({ title: section.title ?? '', subtitle: section.subtitle ?? '', config: section.config ?? {}, isActive: section.isActive });
  }, [section]);
  const save = useApiMutation(() => patch(`/admin/homepage/${section.id}`, f), { success: 'Section saved — homepage पर लागू', invalidate: [['admin-homepage']], onSuccess: onClose });
  const t = section ? TYPES[section.type] : null;
  return (
    <Sheet open={!!section} onOpenChange={(v) => !v && onClose()} className="max-w-xl">
      {section && f && (
        <div className="flex h-full flex-col">
          <div className="border-b border-line p-5"><p className="font-display text-lg font-bold">{t?.label ?? section.type}</p></div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Subtitle"><Input value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} /></Field>
            {(section.type === 'HERO' || section.type === 'BANNER') && (
              <Field label={section.type === 'HERO' ? 'Background image' : 'Banner image'}>
                <FieldInput f={{ key: 'img', label: '', type: 'image' }} value={f.config[section.type === 'HERO' ? 'backgroundUrl' : 'imageUrl'] ?? ''} onChange={(v) => setF({ ...f, config: { ...f.config, [section.type === 'HERO' ? 'backgroundUrl' : 'imageUrl']: v } })} />
              </Field>
            )}
            {section.type === 'FEATURED_LISTINGS' && (
              <Field label="Purpose">
                <Select value={String(f.config.purpose ?? '')} onChange={(e) => setF({ ...f, config: { ...f.config, purpose: e.target.value || undefined } })}>
                  <option value="">Sale + Rent</option>
                  <option value="SALE">Sale</option>
                  <option value="RENT">Rent</option>
                </Select>
              </Field>
            )}
            <Field label="Advanced config (JSON)" hint={`Keys: ${t?.help ?? '—'}`}>
              <FieldInput key={JSON.stringify(section.id)} f={{ key: 'config', label: '', type: 'json' }} value={f.config} onChange={(v) => setF({ ...f, config: v })} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} /> Active</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-line p-4">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>Save</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
