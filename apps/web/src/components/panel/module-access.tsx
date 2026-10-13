'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { moduleAllowed, moduleForPath } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { useAuth } from '@/lib/auth';

export function ModuleAccess({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const config = useConfig();
  const role = useAuth().user?.role ?? '';
  const key = moduleForPath(path);
  if (!key || moduleAllowed(config.modules, key, role)) return <>{children}</>;
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Coming soon • जल्द आ रहा है</p>
      <h1 className="mt-3 text-2xl font-bold">यह सुविधा अभी उपलब्ध नहीं है</h1>
      <p className="my-4 text-muted">आपका data सुरक्षित है। उपलब्ध modules से अपना काम जारी रखें।</p>
      <Link href="/broker/upcoming" className="font-semibold text-brand-600">
        Upcoming features →
      </Link>
    </div>
  );
}
