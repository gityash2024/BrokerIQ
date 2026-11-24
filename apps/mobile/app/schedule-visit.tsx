import { useState } from 'react';

import { ScrollView } from '@/components/keyboard-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react-native';
import { futureConnectDate, hasDelegatedAccess, moduleAllowed, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { DateTimeField } from '@/components/date-time-field';
import { VisitProperties } from '@/components/visit-properties';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { submitTask } from '@/launch/drafts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { timePresets } from '@/lib/time';
import { toast } from '@/lib/toast';
import { Button, Chip, ErrorView, Input, Loader, Row, Txt } from '@/ui';

export default function ScheduleVisit() {
  const { id, when } = useLocalSearchParams<{ id: string; when?: string }>();
  const client = useQueryClient();
  const { user } = useAuth();
  const config = useConfig();
  const policyRole = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const canViewInventory = moduleAllowed(config.modules, 'inventory', policyRole) && hasDelegatedAccess(user, 'inventory', 'view');
  const allowed = !!id && hasDelegatedAccess(user, 'leads', 'create');
  const lead = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api<{ id: string; name: string }>(`/leads/${encodeURIComponent(id)}`),
    enabled: allowed,
  });
  const { c } = useTheme();
  const [at, setAt] = useState(() => futureConnectDate(when));
  const [isCustomDate, setIsCustomDate] = useState(!!at);
  const [properties, setProperties] = useState<LedgerItem[]>([]);
  const [address, setAddress] = useState('');

  const save = useApiMutation(
    () => {
      if (!at || !lead.data) throw new Error('Choose a lead and a valid date and time');
      const payload = {
        leadId: lead.data.id,
        inventoryIds: properties.length ? properties.map((item) => item.id) : undefined,
        scheduledAt: at.toISOString(),
        address: address || null,
      };
      return submitTask('SITE_VISIT_CREATE', payload);
    },
    {
      onSuccess: async (saved) => {
        if (saved.state === 'FAILED') {
          toast.error(saved.error ?? 'Task needs attention. Open Saved drafts.');
          return;
        }
        toast.success(saved.state === 'SYNCED' ? 'Site visit scheduled' : 'Site visit saved on this device. It will sync when connected.');
        await Promise.all(['lead', 'visits', 'leads', 'kanban', 'broker-dashboard'].map((key) => client.invalidateQueries({ queryKey: [key] })));
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/lead/[id]', params: { id } });
      },
    },
  );

  return (
    <BrokerScreen title="Schedule site visit" back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 10 }}>
          {!allowed ? (
            <Txt>This action is not assigned to your account.</Txt>
          ) : lead.error ? (
            <ErrorView error={lead.error} onRetry={() => lead.refetch()} />
          ) : !lead.data ? (
            <Loader />
          ) : (
            <>
              <Txt v="h3">{lead.data.name}</Txt>
              <Txt v="label" color="subtle">
                कब (Date & Time)
              </Txt>
              <Row wrap gap={6} style={{ marginTop: 4, marginBottom: 8 }}>
                {timePresets().map((p) => {
                  const active = !isCustomDate && at?.getTime() === p.at.getTime();
                  return (
                    <Chip
                      key={p.label}
                      label={p.label}
                      active={active}
                      onPress={() => {
                        setIsCustomDate(false);
                        setAt(p.at);
                      }}
                    />
                  );
                })}
                <Chip
                  label="📅 Custom Date / Time"
                  active={isCustomDate}
                  onPress={() => {
                    setIsCustomDate(true);
                  }}
                />
              </Row>

              {isCustomDate && <DateTimeField value={at} onChange={setAt} />}

              {at && (
                <Row gap={6} style={{ alignItems: 'center', marginBottom: 10 }}>
                  <CalendarPlus size={16} color={c.brand} />
                  <Txt v="small" color="brand" style={{ fontWeight: '600' }}>
                    Scheduled for: {at.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </Txt>
                </Row>
              )}

              {isCustomDate && !at && <Txt color="danger">सही तारीख और समय भरें; invalid दिन या समय स्वीकार नहीं होगा।</Txt>}
              {canViewInventory ? (
                <VisitProperties
                  items={properties}
                  onChange={(next) => {
                    const first = properties[0];
                    const suggested = first ? first.address || visitInventoryTitle(first) : '';
                    if (address === suggested || (!address && !first)) setAddress(next[0] ? next[0].address || visitInventoryTitle(next[0]) : '');
                    setProperties(next);
                  }}
                />
              ) : (
                <Txt color="muted">Property selection · Ask your Broker Admin for inventory view access.</Txt>
              )}

              <Txt v="label" color="subtle" style={{ marginBottom: 4 }}>
                Meeting Point / Custom Address
              </Txt>
              <Input value={address} onChangeText={setAddress} placeholder="Gate No., Land mark, या कोई भी नया address लिखें…" />

              <Button title="Schedule visit" loading={save.isPending} disabled={!at} style={{ marginTop: 14 }} onPress={() => save.mutate(undefined)} />
            </>
          )}
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
