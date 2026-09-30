'use client';
import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25 active:scale-[0.98]',
  accent: 'bg-saffron-500 text-slate-950 hover:bg-saffron-400 shadow-sm shadow-saffron-500/30 active:scale-[0.98]',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2 active:scale-[0.98]',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98]',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1fb857] active:scale-[0.98]',
  link: 'text-brand-600 hover:underline px-0 h-auto',
} as const;
const sizes = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-7 text-base gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  href?: string;
  external?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, href, external, disabled, ...rest },
  ref,
) {
  const cls = cn(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 select-none',
    variants[variant],
    sizes[size],
    className,
  );
  const content = (
    <>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </>
  );
  if (href)
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
});
