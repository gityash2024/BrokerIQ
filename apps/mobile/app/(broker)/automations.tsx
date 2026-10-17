import { useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock3, History, Workflow, Zap } from 'lucide-react-native';
import { api, errorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { Button, Txt, ErrorView, Sheet, Row } from '@/ui';
const labels: Record<string, string> = {
  LEAD_CREATED: 'New lead received', NO_ACTIVITY: 'No recent activity', VISIT_SCHEDULED: 'Visit scheduled',
  CREATE_FOLLOW_UP: 'Create follow-up', SEND_WHATSAPP: 'Send WhatsApp message', SEND_WHATSAPP_TEMPLATE: 'Send WhatsApp template',
  NOTIFY_TEAM: 'Notify team', ADD_TAG: 'Add tag',
};
const readable = (value?: string) => value ? labels[value] ?? value.replace(/_/g, ' ').toLowerCase() : 'Not recorded';
export default function Automations() {
  const { c } = useTheme();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const rules = useQuery({ queryKey: ['automations'], queryFn: () => api<any[]>('/automations') });
  const presets = useQuery({ queryKey: ['automation-presets'], queryFn: () => api<any[]>('/automations/presets') });
  const runs = useQuery({ queryKey: ['automation-runs', selected], queryFn: () => api<any[]>(`/automations/${selected}/runs`), enabled: !!selected });
  async function perform(path: string, body: any, method = 'POST') {
    setBusy(true); setError('');
    try { await api(path, { body, method }); await rules.refetch(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return (
    <BrokerScreen title="Automation & Housing" subtitle="Connected workflows. Clear next steps.">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <WorkspaceHero label="A MORE CONNECTED WORKING DAY" title="Keep the next step moving." description="Review your rules and connections in one place.">
          {rules.data && <Row gap={16} style={{ marginTop: 6 }}>
            <View><Txt v="h2" color="white">{rules.data.filter(r => r.isActive).length}</Txt><Txt v="caption" color="#c7d2fe">Enabled</Txt></View>
            <View style={{ width: 1, height: 30, backgroundColor: '#ffffff30' }} />
            <View><Txt v="h2" color="white">{rules.data.filter(r => !r.isActive).length}</Txt><Txt v="caption" color="#c7d2fe">Disabled</Txt></View>
          </Row>}
        </WorkspaceHero>
        <Button variant="secondary" title="Connections & Housing sync" icon={<Workflow size={17} color={c.brand} />} onPress={() => router.push('/connectors')} />
        {!!error && <Txt color="danger">{error}</Txt>}
        {rules.error && <ErrorView error={rules.error} onRetry={() => rules.refetch()} />}
        {rules.isPending && <ActivityIndicator color={c.brand} />}
        <Row style={{ justifyContent: 'space-between' }}><Txt v="h3">Your workflows</Txt>{rules.data && <WorkspaceTag tone="muted" label={String(rules.data.length)} />}</Row>
        {rules.data?.length === 0 && <NativeCard><Txt color="muted">Choose a suggested workflow to get started. New rules start disabled.</Txt></NativeCard>}
        {rules.data?.map((rule: any) => (
          <NativeCard key={rule.id}>
            <Row gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={{ padding: 10, borderRadius: 13, backgroundColor: c.brandSoft }}><Zap size={19} color={c.brand} /></View>
              <View style={{ flex: 1, gap: 6 }}><Txt v="title">{rule.name}</Txt><WorkspaceTag tone={rule.isActive ? 'success' : 'muted'} label={rule.isActive ? 'Enabled' : 'Disabled'} /></View>
              <Switch accessibilityLabel={rule.isActive ? 'Disable rule' : 'Enable rule'} value={!!rule.isActive} disabled={busy} trackColor={{ false: c.line, true: c.brand }} thumbColor="#fff" onValueChange={() => perform(`/automations/${rule.id}`, { isActive: !rule.isActive }, 'PATCH')} />
            </Row>
            <View style={{ backgroundColor: c.surface2, borderRadius: 12, padding: 12, gap: 9 }}>
              <Row><Clock3 size={14} color={c.muted} /><Txt v="caption" color="muted" style={{ flex: 1 }}>{readable(rule.trigger)}</Txt></Row>
              {rule.actions?.map((action: any, index: number) => <Row key={index}><ArrowRight size={14} color={c.brand} /><Txt v="small" style={{ flex: 1 }}>{readable(action.type)}</Txt></Row>)}
            </View>
            <Button title="Execution history" icon={<History size={15} color={c.brand} />} size="sm" variant="ghost" onPress={() => setSelected(rule.id)} />
          </NativeCard>
        ))}
        <Txt v="h3" style={{ marginTop: 4 }}>Suggested workflows</Txt>
        <Txt v="caption" color="muted">Rules start disabled. Review each action before enabling outbound messages.</Txt>
        {presets.error && <ErrorView error={presets.error} onRetry={() => presets.refetch()} />}
        {presets.isPending && <ActivityIndicator color={c.brand} />}
        {presets.data?.filter((p: any) => !rules.data?.some((r) => r.name === p.name)).filter((p: any) => !p.actions?.some((a: any) => a.type === 'SEND_EMAIL' || a.type?.startsWith('ASSIGN_'))).map((preset: any, index: number) => (
          <NativeCard key={preset.name ?? index}>
            <Txt v="title">{preset.name}</Txt>
            <Txt v="small" color="muted">{preset.description || readable(preset.trigger)}</Txt>
            <Row gap={6} wrap>{preset.actions?.map((action: any, i: number) => <WorkspaceTag key={i} label={readable(action.type)} />)}</Row>
            <Button title="Add disabled rule" size="sm" variant="secondary" loading={busy} disabled={!rules.isSuccess} onPress={() => perform('/automations', { ...preset, isActive: false })} />
          </NativeCard>
        ))}
      </ScrollView>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Execution history">
        {runs.error ? <ErrorView error={runs.error} onRetry={() => runs.refetch()} /> : runs.isPending ? <ActivityIndicator color={c.brand} /> : runs.data?.length ? runs.data.map((run: any) => (
          <NativeCard key={run.id}><WorkspaceTag label={readable(run.status)} /><Txt v="small" color="muted">{run.error || run.message || new Date(run.createdAt).toLocaleString()}</Txt></NativeCard>
        )) : <NativeCard><History size={22} color={c.subtle} /><Txt v="title">No executions yet</Txt><Txt v="small" color="muted">Execution history appears after this workflow runs.</Txt></NativeCard>}
      </Sheet>
    </BrokerScreen>
  );
}
