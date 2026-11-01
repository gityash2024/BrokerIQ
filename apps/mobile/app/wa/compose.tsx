import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { authStore, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { readInboxDraft, saveInboxDraft } from '@/lib/inbox-drafts';
import { ErrorView, Header, Loader, Screen } from '@/ui';
import { showError } from '@/lib/hooks';

export default function ComposeLead() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['resolve-lead-inbox', user?.id, leadId],
    retry: false,
    queryFn: () => post<{ conversationId: string }>('/whatsapp/resolve-lead', { leadId }),
    enabled: !!user && !!leadId,
  });
  useEffect(() => {
    if (!query.data || !user) return;
    let cancelled = false;
    const open = async () => {
      const text = await readInboxDraft(`lead:${leadId}`, user.id);
      if (text) await saveInboxDraft(query.data!.conversationId, text, user.id);
      if (cancelled || authStore.get()?.user.id !== user.id) return;
      await saveInboxDraft(`lead:${leadId}`, '', user.id);
      router.replace(`/wa/${query.data!.conversationId}`);
    };
    open().catch(showError);
    return () => {
      cancelled = true;
    };
  }, [query.data, user?.id, leadId]);
  return (
    <Screen>
      <Header title="WhatsApp Inbox" />
      {query.isError ? <ErrorView error={query.error} onRetry={() => query.refetch()} /> : <Loader />}
    </Screen>
  );
}
