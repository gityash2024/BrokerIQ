'use client';
import * as SwitchPrim from '@radix-ui/react-switch';
import { Inbox, Loader2 } from 'lucide-react';
import { initials } from '@brokeriq/shared';
import { cn, img } from '@/lib/utils';

const tones = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  dark: 'bg-slate-900/80 text-white backdrop-blur',
} as const;

export function Badge({ tone = 'neutral', className, children, style }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={style} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block size-2 rounded-full" style={{ background: color }} />;
}

export function Switch({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <SwitchPrim.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition data-[state=checked]:bg-brand-600 disabled:opacity-50 dark:bg-slate-700"
    >
      <SwitchPrim.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
    </SwitchPrim.Root>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function Empty({ icon, title, text, action, className }: { icon?: React.ReactNode; title: string; text?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">{icon ?? <Inbox className="size-6" />}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const hue = [...(name ?? '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img(src, size * 2)} alt={name ?? ''} width={size} height={size} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))` }}
    >
      {initials(name)}
    </span>
  );
}

export function Logo({ className, light, name = 'BrokerIQ' }: { className?: string; light?: boolean; name?: string }) {
  return (
    <span translate="no" data-no-i18n className={cn('inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-fg', className)}>
      <svg viewBox="0 0 64 64" className="size-8 drop-shadow-sm" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#lg)" />
        <path d="M14 34 32 18l18 16v14a2 2 0 0 1-2 2H38V38H26v12H16a2 2 0 0 1-2-2Z" fill="#fff" />
        <circle cx="46" cy="18" r="6" fill="#f59e0b" />
      </svg>
      {name.endsWith('IQ') ? (
        <span>
          {name.slice(0, -2)}
          <span className="text-saffron-500">IQ</span>
        </span>
      ) : (
        name
      )}
    </span>
  );
}

export function Stat({ label, value, icon, hint, tone = 'brand', className }: { label: string; value: React.ReactNode; icon?: React.ReactNode; hint?: React.ReactNode; tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info'; className?: string }) {
  const bg = { brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15', success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15', warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15', danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15', info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15' }[tone];
  return (
    <div className={cn('card flex h-full items-start gap-3 p-4', className)}>
      {icon && <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl', bg)}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
      </div>
    </div>
  );
}
