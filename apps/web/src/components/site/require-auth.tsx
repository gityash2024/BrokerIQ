'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '../ui/misc';

export function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, ready, homePath } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!user && (!roles || roles.includes(user.role) || user.role === 'SUPER_ADMIN');
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(homePath);
  }, [ready, user, allowed, router, pathname, homePath]);
  if (!ready || !allowed) return <PageLoader />;
  return <>{children}</>;
}
