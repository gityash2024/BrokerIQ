import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Button, Txt, ErrorView, Sheet } from '@/ui';
export default function Automations() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const rules = useQuery({ queryKey: ['automations'], queryFn: () => api<any[]>('/automations') });
  const presets = useQuery({ queryKey: ['automation-presets'], queryFn: () => api<any[]>('/automations/presets') });
  const runs = useQuery({ queryKey: ['automation-runs', selected], queryFn: () => api<any[]>(`/automations/${selected}/runs`), enabled: !!selected });
  async function perform(path: string, body: any, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      await api(path, { body, method });
      await rules.refetch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <BrokerScreen title="Automation & Housing" subtitle="Connections, rules and execution history.">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, paddingBottom: 40 }}>
        <Button variant="secondary" title="Connections & Housing sync" onPress={() => router.push('/connectors')} />
        <Txt color="muted">Rules start disabled. Review each action before enabling outbound messages.</Txt>
        {error && <Txt color="danger">{error}</Txt>}
        {rules.error && <ErrorView error={rules.error} />}
        {rules.data?.map((rule: any) => (
          <NativeCard key={rule.id}>
            <Txt v="h3">{rule.name}</Txt>
            <Txt color={rule.isActive ? 'success' : 'muted'}>
              {rule.isActive ? 'Enabled' : 'Disabled'} · {rule.trigger?.replace(/_/g, ' ').toLowerCase()}
            </Txt>
            {rule.actions?.map((action: any, index: number) => (
              <Txt key={index} v="small" color="muted">
                {action.type.replace(/_/g, ' ')}
              </Txt>
            ))}
            <Button
              title={rule.isActive ? 'Disable rule' : 'Enable rule'}
              size="sm"
              variant="secondary"
              loading={busy}
              onPress={() => perform(`/automations/${rule.id}`, { isActive: !rule.isActive }, 'PATCH')}
            />
            <Button title="Execution history" size="sm" variant="ghost" onPress={() => setSelected(rule.id)} />
          </NativeCard>
        ))}
        <Txt v="h3">Suggested workflows</Txt>
        {presets.data
          ?.filter((p: any) => !rules.data?.some((r) => r.name === p.name))
          .filter((p: any) => !p.actions?.some((a: any) => a.type === 'SEND_EMAIL' || a.type.startsWith('ASSIGN_')))
          .map((preset: any, index: number) => (
            <NativeCard key={preset.name ?? index}>
              <Txt v="bodyStrong">{preset.name}</Txt>
              <Txt v="small" color="muted">
                {preset.description || preset.trigger?.replace(/_/g, ' ').toLowerCase()}
              </Txt>
              <Button
                title="Add disabled rule"
                size="sm"
                variant="secondary"
                loading={busy}
                onPress={() => perform('/automations', { ...preset, isActive: false })}
              />
            </NativeCard>
          ))}
      </ScrollView>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Execution history">
        {runs.error ? (
          <ErrorView error={runs.error} />
        ) : runs.data?.length ? (
          runs.data.map((run: any) => (
            <NativeCard key={run.id}>
              <Txt>{run.status}</Txt>
              <Txt v="small" color="muted">
                {run.error || run.message || new Date(run.createdAt).toLocaleString()}
              </Txt>
            </NativeCard>
          ))
        ) : (
          <Txt color="muted">No executions yet</Txt>
        )}
      </Sheet>
    </BrokerScreen>
  );
}
