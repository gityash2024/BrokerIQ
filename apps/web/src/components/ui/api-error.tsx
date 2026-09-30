'use client';
import Link from 'next/link';
import { AlertTriangle, PlugZap, RefreshCw } from 'lucide-react';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from './button';

/**
 * Standard error state. For INTEGRATION_NOT_CONFIGURED it tells the user exactly
 * which credential is missing and links admins / broker admins straight to the settings page.
 */
export function ApiErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { user } = useAuth();
  if (error instanceof ApiError && error.isNotConfigured && error.body.integration) {
    const i = error.body.integration;
    const canFix =
      (i.fixBy === 'SUPER_ADMIN' && user?.role === 'SUPER_ADMIN') ||
      (i.fixBy === 'BROKER_ADMIN' && (user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN'));
    return <IntegrationBanner name={i.name} message={error.body.message} href={canFix ? i.settingsPath : undefined} compact={compact} />;
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">कुछ गड़बड़ हुई</p>
        <p className="mt-0.5 opacity-90">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RefreshCw className="size-4" /> Retry
        </Button>
      )}
    </div>
  );
}

export function IntegrationBanner({ name, message, href, compact }: { name: string; message: string; href?: string; compact?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-900 sm:flex-row sm:items-center dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/5 dark:text-amber-100 ${compact ? 'p-3 text-sm' : 'p-4'}`}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
        <PlugZap className="size-5" />
      </div>
      <div className="flex-1">
        <p className="font-semibold">{name} setup बाकी है</p>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      {href ? (
        <Link href={href} className="inline-flex h-9 items-center rounded-xl bg-amber-500 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-400">
          अभी जोड़ें →
        </Link>
      ) : null}
    </div>
  );
}
