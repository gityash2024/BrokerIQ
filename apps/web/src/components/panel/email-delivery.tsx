'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ApiErrorState } from '@/components/ui/api-error';

type Delivery = { provider: string; providers: { key: string; enabled: boolean; configured: boolean; lastTestOk: boolean | null }[] };
export function EmailDeliverySelector() {
  const query = useQuery({ queryKey: ['email-delivery'], queryFn: () => api<Delivery>('/admin/email-delivery') });
  const select = useApiMutation((provider: string) => patch('/admin/email-delivery', { provider }), {
    success: 'Email delivery provider updated',
    invalidate: [['email-delivery']],
  });
  if (query.isError) return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <section className="card mb-5 space-y-3 p-5">
      <h2 className="font-semibold">Transactional email delivery</h2>
      <p className="text-sm text-muted">
        OTP, recovery, invitations और notifications इसी selected provider से जाएँगे। Automatic provider fallback बंद है। पहले credentials save और connection
        test सफल करें।
      </p>
      <Field label="Email provider">
        <Select value={query.data?.provider || 'smtp'} disabled={!query.data || select.isPending} onChange={(e) => select.mutate(e.target.value)}>
          {['smtp', 'zoho_mail'].map((key) => {
            const state = query.data?.providers.find((p) => p.key === key);
            return (
              <option key={key} value={key} disabled={!state?.configured || state.lastTestOk !== true}>
                {key === 'smtp' ? 'SMTP' : 'Zoho Mail HTTPS'}
                {!state?.enabled
                  ? ' · Disabled'
                  : !state.configured
                    ? ' · Setup needed'
                    : state.lastTestOk === false
                      ? ' · Test failed'
                      : state.lastTestOk !== true
                        ? ' · Test pending'
                        : ''}
              </option>
            );
          })}
        </Select>
      </Field>
      <p className="text-xs text-muted">
        Zoho में replies selected mailbox में आते हैं। अलग firm reply address होने पर email में उसका स्पष्ट mailto link भी रहेगा।
      </p>
    </section>
  );
}
export function ZohoAuthorization() {
  const [code, setCode] = useState('');
  const authorize = useApiMutation(() => post('/admin/integrations/zoho_mail/authorize', { code }), {
    success: 'Zoho authorization saved encrypted; now run Test connection',
    invalidate: [['admin-integrations'], ['email-delivery']],
    onSuccess: () => setCode(''),
  });
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">One-time Zoho authorization</p>
      <p className="text-xs text-muted">
        पहले Client ID, Client Secret, region और From email नीचे save करें। Zoho Self Client में scopes{' '}
        <code>ZohoMail.messages.CREATE,ZohoMail.accounts.READ</code> देकर code खुद generate करें। Email पढ़ने/delete करने की permission न दें।
      </p>
      <Field label="Short-lived authorization code">
        <Input type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Button type="button" size="sm" disabled={!code.trim()} loading={authorize.isPending} onClick={() => authorize.mutate(undefined)}>
        Authorize BrokerIQ
      </Button>
    </div>
  );
}
