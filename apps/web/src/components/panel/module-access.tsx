'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { moduleAllowed, moduleForPath } from '@brokeriq/shared';
import { useConfig, useConfigStatus } from '@/lib/config';
import { useAuth } from '@/lib/auth';

export function ModuleAccess({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const config = useConfig();
  const status = useConfigStatus();
  const role = useAuth().user?.role ?? 'PUBLIC';
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
  if (!key || (!!config.modules && moduleAllowed(config.modules, key, role))) return <>{children}</>;
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Coming soon • जल्द आ रहा है</p>
      <h1 className="mt-3 text-2xl font-bold">यह सुविधा अभी उपलब्ध नहीं है</h1>
      <p className="my-4 text-muted">आपका data सुरक्षित है। उपलब्ध modules से अपना काम जारी रखें।</p>
      <Link href={role === 'USER' || role === 'PUBLIC' ? '/user' : '/broker/upcoming'} className="font-semibold text-brand-600">
        Available features →
      </Link>
    </div>
  );
}
