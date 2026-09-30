'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { BookOpen, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Eye, EyeOff, FlaskConical, Gift, KeyRound, Trash2, XCircle } from 'lucide-react';
import type { IntegrationDef } from '@brokeriq/shared';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Badge, Switch } from '../ui/misc';

export interface IntegrationView {
  key: string;
  enabled: boolean;
  configured: boolean;
  source?: 'database' | 'env' | 'none';
  fields: Record<string, unknown>;
  lastTestedAt?: string | null;
  lastTestOk?: boolean | null;
  lastTestMessage?: string | null;
  updatedAt?: string | null;
}

export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
          aria-label="Copy"
        >
          {done ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </Field>
  );
}

export function StatusPill({ view }: { view?: IntegrationView | null }) {
  if (!view) return null;
  if (!view.configured) return <Badge tone="warning">Not configured</Badge>;
  if (!view.enabled) return <Badge tone="neutral">Disabled</Badge>;
  if (view.lastTestOk === false)
    return (
      <Badge tone="danger">
        <XCircle className="size-3" /> Test failed
      </Badge>
    );
  return (
    <Badge tone="success">
      <CheckCircle2 className="size-3" /> Connected{view.source === 'env' ? ' (env)' : ''}
    </Badge>
  );
}

/**
 * Registry-driven credentials form with a Hindi step-by-step guide.
 * Used by Super Admin → Credentials Center and Broker → Lead connectors.
 */
export function IntegrationCard({
  def,
  view,
  apiBase,
  invalidate,
  defaultOpen,
  extra,
  readOnly,
  icon,
}: {
  def: IntegrationDef;
  view: IntegrationView | null | undefined;
  apiBase: string;
  invalidate: unknown[][];
  defaultOpen?: boolean;
  extra?: React.ReactNode;
  readOnly?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [tab, setTab] = useState<'form' | 'guide'>(view?.configured ? 'form' : 'guide');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [enabled, setEnabled] = useState(view?.enabled ?? true);
  useEffect(() => {
    setValues({ ...(view?.fields ?? {}) });
    setEnabled(view?.enabled ?? true);
  }, [view]);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const save = useApiMutation(() => patch(`${apiBase}/${def.key}`, { enabled, fields: values }), { success: `${def.name} saved`, invalidate });
  const test = useApiMutation(() => post<{ ok: boolean; message: string }>(`${apiBase}/${def.key}/test`), {
    invalidate,
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message, { duration: 8000 })),
  });
  const remove = useApiMutation(() => del(`${apiBase}/${def.key}`), { success: 'Credentials हटाए गए', invalidate });
  const missing = def.fields.filter((f) => f.required && !String(values[f.key] ?? '').trim()).map((f) => f.label);

  return (
    <div id={def.key} className={cn('card overflow-hidden transition', open && 'ring-2 ring-brand-500/20')}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
        <div
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl',
            view?.configured ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-surface-2 text-muted',
          )}
        >
          {icon ?? <KeyRound className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-bold">{def.name}</p>
            <StatusPill view={view} />
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">{def.description}</p>
        </div>
        <ChevronDown className={cn('size-5 shrink-0 text-subtle transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-line">
              <div className="flex flex-wrap items-center gap-2 bg-surface-2/50 px-5 py-2.5 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <Gift className="size-3.5" /> {def.freeTier}
                </span>
                <span className="text-subtle">·</span>
                <span className="text-muted">इसके लिए ज़रूरी: {def.usedFor.join(', ')}</span>
              </div>
              <div className="flex gap-1 px-5 pt-4">
                {(['guide', 'form'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'relative rounded-lg px-3 py-1.5 text-sm font-semibold',
                      tab === t ? 'text-brand-700 dark:text-white' : 'text-muted hover:text-fg',
                    )}
                  >
                    {tab === t && <motion.span layoutId={`int-tab-${def.key}`} className="absolute inset-0 rounded-lg bg-brand-50 dark:bg-brand-500/15" />}
                    <span className="relative inline-flex items-center gap-1.5">
                      {t === 'guide' ? (
                        <>
                          <BookOpen className="size-4" /> कैसे पाएँ (steps)
                        </>
                      ) : (
                        <>
                          <KeyRound className="size-4" /> Credentials
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {tab === 'guide' ? (
                <div className="p-5">
                  <ol className="relative space-y-4 border-l-2 border-dashed border-line pl-6">
                    {def.steps.map((s, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative text-sm leading-6"
                      >
                        <span className="absolute top-0 -left-[35px] grid size-6 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white ring-4 ring-surface">
                          {i + 1}
                        </span>
                        <StepText text={s} />
                      </motion.li>
                    ))}
                  </ol>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setTab('form')}>
                      Credentials भरें →
                    </Button>
                    <Button size="sm" variant="secondary" href={def.docsUrl} external>
                      Official docs <ExternalLink className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  {extra && (
                    <div className="mb-5 space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
                      {extra}
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {def.fields.map((f) => {
                      const v = values[f.key];
                      const setV = (x: unknown) => setValues((p) => ({ ...p, [f.key]: x }));
                      const wide = f.type === 'textarea' || f.type === 'url';
                      return (
                        <Field key={f.key} label={f.label} required={f.required} hint={f.help} className={cn(wide && 'sm:col-span-2')}>
                          {f.type === 'select' ? (
                            <Select value={String(v ?? '')} onChange={(e) => setV(e.target.value)} disabled={readOnly}>
                              <option value="">—</option>
                              {f.options?.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </Select>
                          ) : f.type === 'boolean' ? (
                            <div className="flex h-11 items-center">
                              <Switch checked={v === true || v === 'true'} onCheckedChange={setV} disabled={readOnly} />
                            </div>
                          ) : f.type === 'textarea' ? (
                            <Textarea
                              value={String(v ?? '')}
                              onChange={(e) => setV(e.target.value)}
                              placeholder={f.placeholder}
                              disabled={readOnly}
                              className="font-mono text-xs"
                            />
                          ) : f.secret ? (
                            <div className="relative">
                              <Input
                                type={reveal[f.key] ? 'text' : 'password'}
                                value={String(v ?? '')}
                                onFocus={() => String(v ?? '').startsWith('••') && setV('')}
                                onChange={(e) => setV(e.target.value)}
                                placeholder={f.placeholder ?? (view?.fields?.[f.key] ? 'Saved — बदलने के लिए नया डालें' : '')}
                                disabled={readOnly}
                                autoComplete="off"
                                className="pr-10 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))}
                                className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle"
                                aria-label="Show"
                              >
                                {reveal[f.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              </button>
                            </div>
                          ) : (
                            <Input
                              type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                              value={String(v ?? '')}
                              onChange={(e) => setV(e.target.value)}
                              placeholder={f.placeholder}
                              disabled={readOnly}
                            />
                          )}
                        </Field>
                      );
                    })}
                  </div>
                  {view?.lastTestedAt && (
                    <div
                      className={cn(
                        'mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm',
                        view.lastTestOk
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300',
                      )}
                    >
                      {view.lastTestOk ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
                      <span className="flex-1">{view.lastTestMessage}</span>
                      <span className="text-xs opacity-70">{formatDateTime(view.lastTestedAt)}</span>
                    </div>
                  )}
                  {!readOnly && (
                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                      <label className="mr-auto flex items-center gap-2 text-sm font-medium">
                        <Switch checked={enabled} onCheckedChange={setEnabled} /> Enabled
                      </label>
                      {view?.source === 'database' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirm(`${def.name} के saved credentials हटाएँ?`) && remove.mutate(undefined)}
                          loading={remove.isPending}
                        >
                          <Trash2 className="size-4" /> Remove
                        </Button>
                      )}
                      {def.testable && (
                        <Button variant="secondary" size="sm" onClick={() => test.mutate(undefined)} loading={test.isPending} disabled={!view?.configured}>
                          <FlaskConical className="size-4" /> Test connection
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => save.mutate(undefined)}
                        loading={save.isPending}
                        disabled={missing.length > 0}
                        title={missing.length ? `ज़रूरी: ${missing.join(', ')}` : undefined}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Renders URLs inside a guide step as links and `code` spans as copyable chips. */
function StepText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+|`[^`]+`)/g);
  return (
    <span>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer"
            className="font-medium break-all text-brand-600 underline decoration-brand-300 underline-offset-2"
          >
            {p}
          </a>
        ) : p.startsWith('`') ? (
          <code
            key={i}
            onClick={() => (navigator.clipboard.writeText(p.slice(1, -1)), toast.success('Copied'))}
            className="cursor-pointer rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs break-all hover:bg-brand-50"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
