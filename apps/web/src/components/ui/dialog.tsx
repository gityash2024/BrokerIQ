'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm data-[state=open]:animate-[fade-up_.2s_ease]" />
        <D.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-line bg-surface shadow-2xl outline-none',
            w,
          )}
        >
          {(title || description) && (
            <div className="border-b border-line px-6 pt-5 pb-4">
              {title && <D.Title className="pr-8 font-display text-lg font-bold">{title}</D.Title>}
              {description && <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>}
            </div>
          )}
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
          <D.Close className="absolute top-4 right-4 rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  side?: 'right' | 'left' | 'bottom';
  className?: string;
}) {
  const pos = {
    right: 'right-0 top-0 h-dvh w-full max-w-md border-l',
    left: 'left-0 top-0 h-dvh w-[85vw] max-w-xs border-r',
    bottom: 'bottom-0 left-0 max-h-[88dvh] w-full rounded-t-3xl border-t',
  }[side];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
        <D.Content className={cn('fixed z-50 flex flex-col border-line bg-surface shadow-2xl outline-none', pos, className)}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <D.Title className="font-display text-lg font-bold">{title}</D.Title>
            <D.Close className="rounded-lg p-1.5 text-subtle hover:bg-surface-2" aria-label="Close">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
