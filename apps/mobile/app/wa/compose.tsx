import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { leadInboxDraftTarget } from '@brokeriq/shared';
import { authStore, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { moveInboxDraft } from '@/lib/inbox-drafts';
import { ErrorView, Header, Loader, Screen } from '@/ui';
import { showError } from '@/lib/hooks';

export default function ComposeLead() {
  const { leadId, channel: requestedChannel } = useLocalSearchParams<{ leadId: string; channel?: string }>();
  const channel = requestedChannel === 'SMS' ? 'SMS' : requestedChannel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP';
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['resolve-lead-inbox', user?.id, leadId, channel],
    retry: false,
    queryFn: () =>
      post<{ conversationId: string }>(channel !== 'WHATSAPP' ? '/messaging/resolve-lead' : '/whatsapp/resolve-lead', {
        leadId,
        ...(channel !== 'WHATSAPP' ? { channel } : {}),
      }),
    enabled: !!user && !!leadId,
  });
  useEffect(() => {
    if (!query.data || !user) return;
    let cancelled = false;
    const open = async () => {
      const target = leadInboxDraftTarget(leadId, channel);
      if (cancelled || authStore.get()?.user.id !== user.id) return;
      const result = await moveInboxDraft(target, query.data!.conversationId, user.id);
      if (cancelled || authStore.get()?.user.id !== user.id) return;
      if (result === 'CANCELLED') return;
      if (result === 'CONFLICT') showError(new Error('Inbox का मौजूदा draft सुरक्षित रखा है। नया shared draft भी इसी lead/channel के लिए saved है।'));
      router.replace(`/wa/${query.data!.conversationId}`);
    };
    open().catch(showError);
    return () => {
      cancelled = true;
    };
  }, [query.data, user?.id, leadId, channel]);
  return (
    <Screen>
      <Header title={`${channel} Inbox`} />
      {query.isError ? <ErrorView error={query.error} onRetry={() => query.refetch()} /> : <Loader />}
    </Screen>
  );
}
