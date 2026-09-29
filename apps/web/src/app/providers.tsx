'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { PublicConfig } from '@brokeriq/shared';
import { AuthProvider } from '@/lib/auth';
import { ConfigProvider } from '@/lib/config';
import { ApiError } from '@/lib/api';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { AssistantWidget } from '@/components/assistant/assistant';
import { I18nProvider } from '@/lib/i18n';

export function Providers({ children, config }: { children: React.ReactNode; config: PublicConfig | null }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && [401, 403, 404, 424].includes(err.status)) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider initial={config}>
        <AuthProvider>
          <I18nProvider>
            {children}
            <FeedbackWidget />
            <AssistantWidget />
            <Toaster position="top-center" richColors closeButton />
          </I18nProvider>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
