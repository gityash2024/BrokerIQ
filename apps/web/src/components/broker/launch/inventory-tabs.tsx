'use client';

import Link from 'next/link';
import { brokerWorkspaceGroups, delegatedModulePolicies, hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';

export function InventoryTabs({ active }: { active: string }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const group = brokerWorkspaceGroups(
    delegated ? delegatedModulePolicies(modules, user?.delegatedPermissions ?? []) : modules,
    delegated ? 'BROKER_ADMIN' : (user?.role ?? ''),
  ).find((entry) => entry.key === 'inventory');
  return (
    <nav aria-label="Inventory sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {group?.links
        .filter((link) => !link.href.includes('?') && (link.href !== '/broker/publications' || hasDelegatedAccess(user, 'inventory', 'approve')))
        .map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active === link.href ? 'page' : undefined}
            className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${active === link.href ? 'border-brand-600 text-brand-600' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {link.label}
          </Link>
        ))}
    </nav>
  );
}
