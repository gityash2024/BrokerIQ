'use client';
import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Animated segmented control. */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; count?: number }[]; className?: string; size?: 'sm' | 'md' }) {
  const id = useId();
  return (
    <div className={cn('inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-1 scrollbar-none', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('relative rounded-lg font-semibold whitespace-nowrap transition', size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', value === o.value ? 'text-fg' : 'text-muted hover:text-fg')}
        >
          {value === o.value && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative flex items-center gap-1.5">
            {o.label}
            {o.count != null && <span className="rounded-full bg-brand-100 px-1.5 text-[10px] text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">{o.count}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
