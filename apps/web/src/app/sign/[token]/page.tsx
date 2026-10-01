'use client';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Logo, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { OtpConfirm } from '@/components/site/otp-confirm';

/** Public page where a landlord / tenant reads the rent agreement and confirms it with an OTP. */
export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const q = useQuery({ queryKey: ['sign', token], queryFn: () => api<any>(`/public/sign/${token}`, { auth: false }) });
  const v = q.data;
  const a = v?.agreement;
  return (
    <main className="min-h-screen bg-surface-2 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        {q.isError ? (
          <ApiErrorState error={q.error} />
        ) : !v ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="card space-y-3 p-5">
              <p className="text-xs text-muted">Rent agreement — {v.party === 'LANDLORD' ? 'Landlord (Licensor)' : 'Tenant (Licensee)'}</p>
              <h1 className="font-display text-xl font-extrabold">
                नमस्ते <span data-no-i18n>{v.name}</span>
              </h1>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted">Property</dt>
                <dd data-no-i18n>{a.propertyAddress}</dd>
                <dt className="text-muted">Landlord</dt>
                <dd data-no-i18n>{a.landlordName}</dd>
                <dt className="text-muted">Tenant</dt>
                <dd data-no-i18n>{a.tenantName}</dd>
                <dt className="text-muted">किराया</dt>
                <dd>{formatINR(a.rent)}/month</dd>
                <dt className="text-muted">Deposit</dt>
                <dd>{formatINR(a.deposit)}</dd>
                <dt className="text-muted">शुरुआत</dt>
                <dd>
                  {formatDate(a.startDate)} · {a.months} महीने
                </dd>
                <dt className="text-muted">Lock-in / notice</dt>
                <dd>
                  {a.lockInMonths} / {a.noticeMonths} महीने
                </dd>
              </dl>
              <Button variant="secondary" href={v.pdfUrl} external>
                <FileDown className="size-4" /> पूरा agreement पढ़ें (PDF)
              </Button>
              <div className="flex flex-wrap gap-2">
                {v.parties.map((p: any) => (
                  <Badge key={p.party} tone={p.signedAt ? 'success' : 'warning'}>
                    {p.party === 'LANDLORD' ? 'Landlord' : 'Tenant'} {p.signedAt ? '✓' : 'pending'}
                  </Badge>
                ))}
              </div>
            </div>
            {v.termsChanged ? (
              <p className="card p-4 text-sm text-rose-600">Agreement की शर्तें बदल गई हैं — भेजने वाले से नया link मँगवाएँ।</p>
            ) : (
              <OtpConfirm
                label="मैंने agreement पढ़ लिया है और शर्तों से सहमत हूँ"
                done={!!v.signedAt}
                doneText={`आपने ${formatDate(v.signedAt)} को confirm किया${v.signStatus === 'SIGNED' ? ' — दोनों ने confirm कर दिया है' : ''}`}
                requestPath={`/public/sign/${token}/otp`}
                confirmPath={`/public/sign/${token}/confirm`}
                onDone={() => q.refetch()}
              />
            )}
            <p className="text-xs text-muted">
              यह electronic confirmation है (OTP, समय, IP और agreement की SHA-256 fingerprint दर्ज होती है)। यह stamp duty, notary या registration की जगह नहीं
              लेता।
              {v.documentHash && <span className="mt-1 block break-all font-mono text-[10px]">SHA-256: {v.documentHash}</span>}
            </p>
            <p className="flex items-center justify-center gap-2 text-xs text-muted">
              Powered by <Logo className="h-4" />
            </p>
          </>
        )}
      </div>
    </main>
  );
}
