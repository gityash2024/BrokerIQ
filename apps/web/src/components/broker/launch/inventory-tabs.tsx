'use client';

import Link from 'next/link';
import { brokerWorkspaceGroups, hasDelegatedAccess, moduleAllowed } from '@brokeriq/shared';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';

export function InventoryTabs({ active }: { active: string }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const group = brokerWorkspaceGroups(undefined, 'BROKER_ADMIN').find((entry) => entry.key === 'inventory');
  return (
    <nav aria-label="Inventory sections" className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {group?.links
        .filter((link) => !link.href.includes('?'))
        .map((link) => {
          const canOpen =
            moduleAllowed(modules, link.module, role) &&
            hasDelegatedAccess(user, link.module, 'view') &&
            (!link.adminOnly || ((user?.role === 'BROKER_ADMIN' || user?.role === 'SUB_BROKER_ADMIN') && hasDelegatedAccess(user, 'inventory', 'approve')));
          const className = `min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${active === link.href ? 'border-brand-600 text-brand-600' : 'border-transparent text-muted hover:text-fg'}`;
          return canOpen ? (
            <Link key={link.href} href={link.href} aria-current={active === link.href ? 'page' : undefined} className={className}>
              {link.label}
            </Link>
          ) : (
            <button
              key={link.href}
              type="button"
              aria-disabled="true"
              className={className}
              onClick={() =>
                toast.info(
                  link.adminOnly ? 'Publication review requires Broker Admin approval access.' : 'Ask your Broker Admin for access to this inventory section.',
                )
              }
            >
              {link.label}
            </button>
          );
        })}
    </nav>
  );
}
