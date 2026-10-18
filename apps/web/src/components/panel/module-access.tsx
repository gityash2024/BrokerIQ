'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { moduleAllowed, moduleForPath, defaultModulePolicies, PLATFORM_MODULES } from '@brokeriq/shared';
import { Clock3, LockKeyhole, EyeOff } from 'lucide-react';
import { useConfig, useConfigStatus } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { Fragment } from 'react';

export function ModuleAccess({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const config = useConfig();
  const status = useConfigStatus();
  const user = useAuth().user;
  const role = user?.role ?? 'PUBLIC';
  const key = moduleForPath(path);
  if (key && !status.loaded)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center" role="status">
        <h1 className="text-xl font-bold">{status.error ? 'Connection needs attention' : 'Loading workspace permissions…'}</h1>
        {!!status.error && (
          <button onClick={status.retry} className="mt-4 text-brand-600">
            Retry
          </button>
        )}
      </div>
    );
  if (!key || (!!config.modules && moduleAllowed(config.modules, key, role))) return <Fragment key={user?.id ?? 'guest'}>{children}</Fragment>;
  const policy = config.modules?.[key] ?? defaultModulePolicies()[key];
  const upcoming = policy?.state === 'COMING_SOON';
  const hidden = policy?.state === 'HIDDEN';
  const Icon = upcoming ? Clock3 : hidden ? EyeOff : LockKeyhole;
  const name = PLATFORM_MODULES.find((module) => module.key === key)?.name ?? 'Workspace feature';
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center">
      <Icon className="mx-auto mb-5 size-10 text-brand-600" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
        {upcoming ? 'Coming soon · Disabled' : hidden ? 'Module disabled' : 'Access restricted'}
      </p>
      <h1 className="mt-3 font-display text-2xl font-bold">{name}</h1>
      <p className="my-4 text-sm leading-6 text-muted">
        {upcoming
          ? 'This workflow is on the product roadmap. It will be available when enabled by the platform.'
          : hidden
            ? 'The platform has disabled this module. Existing records are preserved.'
            : 'Your account does not have permission to open this workflow. Contact your workspace administrator if access is needed.'}
      </p>
      <Link
        href={role === 'SUPER_ADMIN' ? '/admin' : role === 'USER' || role === 'PUBLIC' ? '/user' : '/broker'}
        className="inline-flex min-h-11 items-center font-semibold text-brand-600"
      >
        Available features →
      </Link>
    </div>
  );
}
