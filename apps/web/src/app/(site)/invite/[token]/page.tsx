'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageShell } from '@/components/site/page-shell';
import { Avatar, PageLoader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, setSession } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const q = useQuery({ queryKey: ['invite', token], queryFn: () => api<any>(`/invites/${token}`, { auth: false }) });
  const accept = async () => {
    if (!user) return router.push(`/login?next=/invite/${token}`);
    setLoading(true);
    try {
      setSession(await api(`/invites/${token}/accept`, { method: 'POST' }));
      toast.success('Team में शामिल हो गए 🎉');
      router.replace('/broker');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <PageShell>
      <div className="container-x grid min-h-[60vh] place-items-center py-14">
        {q.isLoading ? (
          <PageLoader />
        ) : q.error ? (
          <ApiErrorState error={q.error} />
        ) : (
          <div className="card w-full max-w-md p-8 text-center">
            <Avatar name={q.data.organization.name} src={q.data.organization.logoUrl} size={72} className="mx-auto" />
            <h1 className="mt-4 font-display text-2xl font-extrabold">{q.data.organization.name}</h1>
            <p className="mt-1 text-muted">ने आपको ({q.data.email}) अपनी team में invite किया है</p>
            <Button className="mt-6 w-full" size="lg" onClick={accept} loading={loading}>
              <Users className="size-5" /> {user ? 'Invite accept करें' : 'Login करके accept करें'}
            </Button>
            {!user && (
              <p className="mt-3 text-sm text-muted">
                Account नहीं है? <a className="text-brand-600" href={`/signup?next=/invite/${token}`}>{q.data.email} से sign up करें</a>
              </p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
