'use client';

import Link from 'next/link';
import { hasPreviousPage } from '@/lib/navigation';
import { Button, type ButtonProps } from './button';
import type { MouseEvent, ComponentProps } from 'react';

function followHistory(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!hasPreviousPage()) return;
  event.preventDefault();
  window.history.back();
}

/** Keep the existing link target for direct entries and modified clicks. */
export function BackButton({ onClick, ...props }: ButtonProps & { href: string }) {
  return (
    <Button {...props} onClick={(event) => {
      onClick?.(event);
      followHistory(event);
    }} />
  );
}

export function BackLink({ onClick, ...props }: Omit<ComponentProps<typeof Link>, 'key'>) {
  return (
    <Link {...props} onClick={(event) => {
      onClick?.(event);
      followHistory(event);
    }} />
  );
}
