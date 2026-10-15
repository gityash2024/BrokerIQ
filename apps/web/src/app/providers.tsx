'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { moduleAllowed, type PublicConfig } from '@brokeriq/shared';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ConfigProvider, useConfig } from '@/lib/config';
import { ApiError } from '@/lib/api';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { AssistantWidget } from '@/components/assistant/assistant';
import { I18nProvider } from '@/lib/i18n';
import { installGlobalErrorHandlers } from '@/lib/report-error';
import { captureReferral } from '@/lib/referral';
import { WebPushPrompt } from '@/components/site/web-push';

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
  useEffect(() => (installGlobalErrorHandlers(), captureReferral()), []);
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider initial={config}>
        <AuthProvider>
          <I18nProvider>
            {children}
            <OptionalWidgets />
            <Toaster position="top-center" richColors closeButton />
          </I18nProvider>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

function OptionalWidgets(){const config=useConfig();const role=useAuth().user?.role??'';return <>{moduleAllowed(config.modules,'assistant',role)&&<AssistantWidget/>}{moduleAllowed(config.modules,'web_push',role)&&<WebPushPrompt/>}{moduleAllowed(config.modules,'legacy',role)&&<FeedbackWidget/>}</>;}
