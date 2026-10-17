'use client';
import { createContext, useContext, useId, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const FieldContext = createContext<{ id: string; description?: string; invalid: boolean } | null>(null);
const base =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg placeholder:text-subtle transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }>(function Input(
  { className, icon, ...p },
  ref,
) {
  const field = useContext(FieldContext);
  const accessibility = {
    id: p.id ?? field?.id,
    'aria-describedby': p['aria-describedby'] ?? field?.description,
    'aria-invalid': p['aria-invalid'] ?? field?.invalid,
  };
  if (icon)
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle">{icon}</span>
        <input ref={ref} className={cn(base, 'h-11 pl-10', className)} {...p} {...accessibility} />
      </div>
    );
  return <input ref={ref} className={cn(base, 'h-11', className)} {...p} {...accessibility} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  const field = useContext(FieldContext);
  return (
    <textarea
      ref={ref}
      className={cn(base, 'min-h-24 py-3 leading-6', className)}
      {...p}
      id={p.id ?? field?.id}
      aria-describedby={p['aria-describedby'] ?? field?.description}
      aria-invalid={p['aria-invalid'] ?? field?.invalid}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  const field = useContext(FieldContext);
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(base, 'h-11 appearance-none pr-9', className)}
        {...p}
        id={p.id ?? field?.id}
        aria-describedby={p['aria-describedby'] ?? field?.description}
        aria-invalid={p['aria-invalid'] ?? field?.invalid}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" />
    </div>
  );
});

export function Label({ children, className, required, ...p }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('mb-1.5 block text-[13px] font-semibold text-fg', className)} {...p}>
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <FieldContext.Provider value={{ id, description: error || hint ? id + '-description' : undefined, invalid: !!error }}>
      <div className={className}>
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        {children}
        {error ? (
          <p id={id + '-description'} role="alert" className="mt-1 text-xs text-rose-500">
            {error}
          </p>
        ) : hint ? (
          <p id={id + '-description'} className="mt-1 text-xs text-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition active:scale-95',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/30'
          : 'border-line bg-surface text-muted hover:border-brand-300 hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}
