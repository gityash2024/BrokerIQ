'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { IntegrationDef } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/panel/shell';
import { CopyField, IntegrationCard, type IntegrationView } from '@/components/panel/integration-card';
import { ApiErrorState } from '@/components/ui/api-error';
import { PageLoader } from '@/components/ui/misc';

type Connector = IntegrationDef & { config: IntegrationView; extra: Record<string, string>; state?: { status: string; lastError?: string | null } };
function FirmConnectors() {
  const { id } = useParams<{ id: string }>();
  const focus = useSearchParams().get('key');
  const { user } = useAuth();
  const path = `/admin/organizations/${encodeURIComponent(id)}/connectors`;
  const query = useQuery({
    queryKey: ['admin-firm-connectors', user?.id, id],
    queryFn: () => api<{ firm: { id: string; name: string; status: string }; connectors: Connector[] }>(path),
    enabled: user?.role === 'SUPER_ADMIN' && !!id,
  });
  if (!user) return <PageLoader />;
  if (user.role !== 'SUPER_ADMIN') return <p>केवल Super Admin firm integrations manage कर सकते हैं।</p>;
  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  return (
    <>
      <Link href="/admin/brokers" className="mb-3 inline-block text-sm font-semibold text-brand-600">
        Broker firms →
      </Link>
      <PageHeader
        title={`${query.data.firm.name} · Integrations`}
        subtitle="इस चुनी हुई firm के connections। Credentials encrypted रहते हैं; दूसरी firm पर fallback नहीं है।"
      />
      <div className="space-y-4">
        {query.data.connectors.map((connector) =>
          connector.key === 'gmail' ? (
            <section key={connector.key} className="card space-y-2 p-5">
              <h2 className="font-bold">{connector.name}</h2>
              <p className="text-sm text-muted">
                {connector.config.configured ? 'Connected' : 'Not connected'} · Gmail consent इसी firm का Broker Admin अपने business mailbox से पूरा करेगा।
              </p>
              <p className="text-sm text-muted">Super Admin यहाँ mailbox identity या OAuth tokens manually नहीं बदल सकता।</p>
            </section>
          ) : (
            <IntegrationCard
              key={connector.key}
              def={connector}
              view={connector.config}
              apiBase={path}
              invalidate={[['admin-firm-connectors', user.id, id]]}
              defaultOpen={focus === connector.key}
              extra={
                <>
                  {connector.extra?.webhookUrl && <CopyField label="Callback URL" value={connector.extra.webhookUrl} />}
                  {connector.extra?.verifyToken && <CopyField label="Verify token" value={connector.extra.verifyToken} />}
                  {connector.extra?.connectUrl && <CopyField label="Connect URL" value={connector.extra.connectUrl} />}
                  {connector.state?.status && <p className="text-sm text-muted">{connector.state.status}</p>}
                  {connector.state?.lastError && <p className="text-sm text-danger">{connector.state.lastError}</p>}
                </>
              }
            />
          ),
        )}
      </div>
    </>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <FirmConnectors />
    </Suspense>
  );
}
