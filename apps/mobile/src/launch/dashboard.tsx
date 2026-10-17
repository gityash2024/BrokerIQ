import { useState } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, BarChart3, ChevronDown } from 'lucide-react-native';
import { type DashboardData, type DashboardChart, dashboardQuerySchema } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, ErrorView, Input, Txt } from '@/ui';
const colors = ['#4f46e5', '#f59e0b', '#0d9488', '#0284c7', '#e11d48', '#7c3aed'];
function href(web: string) {
  const [path, query] = web.split('?');
  if (path === '/broker/activity' || path === '/user/account/activity') return '/dashboard-records' + (query ? '?' + query : '');
  const map: Record<string, string> = {
    '/broker/inventory': '/(broker)/inventory',
    '/broker/imports': '/(broker)/inbox',
    '/broker/leads': '/(broker)/leads',
    '/broker/leads/requirements': '/requirements',
    '/broker/follow-ups': '/follow-ups',
    '/broker/visits': '/visits',
    '/user/account/saved': '/(user)/saved',
    '/user/account/searches': '/(user)/saved',
    '/user/account/enquiries': '/enquiries',
    '/user/account/visits': '/my-visits',
  };
  return (map[path] ?? '/customer-overview') + (query ? '?' + query : '');
}
function NativeChart({ chart }: { chart: DashboardChart }) {
  const { c } = useTheme();
  const [details, setDetails] = useState(false);
  const max = Math.max(1, ...chart.points.map((p) => p.value));
  const sum = chart.points.reduce((s, p) => s + p.value, 0);
  const width = 300,
    height = 100;
  let cumulative = 0;
  const line = chart.points
    .map((p, i) => `${i ? 'L' : 'M'} ${8 + (i * (width - 16)) / Math.max(chart.points.length - 1, 1)} ${height - 8 - (p.value / max) * (height - 20)}`)
    .join(' ');
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt v="title" style={{ flex: 1 }}>
          {chart.title}
        </Txt>
        <Txt v="caption" color="muted">
          {chart.scope === 'current' ? 'Current' : 'Period'}
        </Txt>
      </View>
      {sum > 0 ? (
        <View accessibilityRole="image" accessibilityLabel={chart.title + ': ' + chart.points.map((p) => p.label + ' ' + p.value).join(', ')}>
          <Svg width="100%" height={chart.kind === 'donut' ? 132 : 110} viewBox={chart.kind === 'donut' ? '0 0 300 132' : '0 0 300 110'}>
            {chart.kind === 'line' ? (
              <>
                <Line x1="8" x2="292" y1="92" y2="92" stroke={c.line} />
                <Path d={line} stroke={c.brand} strokeWidth="2.5" fill="none" />
                {chart.points.map((p, i) => (
                  <Circle
                    key={p.key}
                    cx={8 + (i * 284) / Math.max(chart.points.length - 1, 1)}
                    cy={92 - (p.value / max) * 80}
                    r="3"
                    fill={c.brand}
                    onPress={() => router.push(href(p.href) as any)}
                  />
                ))}
              </>
            ) : chart.kind === 'bar' ? (
              chart.points.map((p, i) => (
                <Rect
                  key={p.key}
                  x={8 + (i * 284) / Math.max(chart.points.length, 1)}
                  y={92 - (p.value / max) * 80}
                  width={Math.min(32, 240 / Math.max(chart.points.length, 1))}
                  height={(p.value / max) * 80}
                  rx="4"
                  fill={colors[i % colors.length]}
                  onPress={() => router.push(href(p.href) as any)}
                />
              ))
            ) : (
              chart.points
                .filter((p) => p.value > 0)
                .map((p, i) => {
                  const fraction = p.value / sum;
                  const offset = cumulative;
                  cumulative += fraction;
                  return (
                    <Circle
                      key={p.key}
                      cx="150"
                      cy="66"
                      r="44"
                      fill="none"
                      stroke={colors[i % colors.length]}
                      strokeWidth="17"
                      strokeDasharray={`${fraction * 276.46} ${276.46}`}
                      strokeDashoffset={-offset * 276.46}
                      rotation="-90"
                      origin="150,66"
                      onPress={() => router.push(href(p.href) as any)}
                    />
                  );
                })
            )}
          </Svg>
          {chart.kind === 'line' && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="caption" color="muted">
                {chart.points[0]?.label}
              </Txt>
              <Txt v="caption" color="muted">
                {chart.points.at(-1)?.label}
              </Txt>
            </View>
          )}
        </View>
      ) : (
        <View style={{ alignItems: 'center', padding: 22, backgroundColor: c.surface2, borderRadius: 12, gap: 8 }}>
          <BarChart3 size={22} color={c.subtle} />
          <Txt v="small" color="muted">
            No activity recorded in this period.
          </Txt>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        onPress={() => setDetails(!details)}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: c.line }}
      >
        <Txt v="caption" color="brand">
          View data & open records
        </Txt>
        <ChevronDown size={15} color={c.brand} />
      </Pressable>
      {details &&
        chart.points.map((p, i) => (
          <Pressable key={p.key} onPress={() => router.push(href(p.href) as any)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
            <Txt v="small" style={{ flex: 1 }}>
              {p.label}
            </Txt>
            <Txt v="title">{p.value}</Txt>
            <ArrowUpRight size={14} color={c.brand} />
          </Pressable>
        ))}
    </View>
  );
}
export function NativeDashboard({ role }: { role: 'broker' | 'user' }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const [days, setDays] = useState('30');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState('');
  const query = applied ? new URLSearchParams(applied).toString() : 'days=' + days;
  const q = useQuery({
    queryKey: ['enterprise-native', role, user?.id, query],
    queryFn: () => api<DashboardData>((role === 'broker' ? '/broker/dashboard/metrics' : '/me/dashboard') + '?' + query),
    refetchInterval: 60000,
  });
  const [showCustom, setShowCustom] = useState(false);
  return (
    <View style={{ gap: 16 }}>
      <LinearGradient colors={['#1e1b4b', '#4338ca']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, borderRadius: 22, gap: 8 }}>
        <Txt v="label" color="#c7d2fe">
          {role === 'broker' ? 'YOUR BUSINESS, IN FOCUS' : 'YOUR PROPERTY JOURNEY'}
        </Txt>
        <Txt v="h2" color="white">{`Good to see you, ${user?.name.split(' ')[0] ?? ''}.`}</Txt>
        <Txt v="small" color="#e0e7ff">
          {role === 'broker' ? 'Your inventory, relationships and next actions.' : 'Your favourites, conversations and next visit.'}
        </Txt>
      </LinearGradient>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {['7', '30', '90'].map((v) => (
          <Button
            key={v}
            size="sm"
            variant={days === v && !applied ? 'primary' : 'secondary'}
            title={v + ' days'}
            onPress={() => {
              setDays(v);
              setApplied(null);
              setShowCustom(false);
            }}
          />
        ))}
        <Button size="sm" variant="secondary" title="Custom" onPress={() => setShowCustom(!showCustom)} />
      </View>
      {showCustom && (
        <View style={{ gap: 10 }}>
          <Input label="From (YYYY-MM-DD)" value={custom.from} onChangeText={(from) => setCustom({ ...custom, from })} />
          <Input label="To (YYYY-MM-DD)" value={custom.to} onChangeText={(to) => setCustom({ ...custom, to })} />
          <Button
            size="sm"
            title="Apply dates"
            onPress={() => {
              const parsed = dashboardQuerySchema.safeParse(custom);
              if (!parsed.success) setError(parsed.error.issues[0].message);
              else {
                setError('');
                setApplied(custom);
              }
            }}
          />
          {!!error && <Txt color="danger">{error}</Txt>}
        </View>
      )}
      {q.error && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
      {q.isPending && <Txt color="muted">Loading your dashboard…</Txt>}
      {q.data && (
        <>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {q.data.metrics.map((m, i) => (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}: ${m.value ?? 'Unavailable'}. ${m.definition}`}
                onPress={() => router.push(href(m.href) as any)}
                style={{
                  flexGrow: 1,
                  flexBasis: '46%',
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.surface,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ width: 22, height: 3, borderRadius: 3, backgroundColor: colors[i % colors.length], marginTop: 7 }} />
                  <ArrowUpRight size={14} color={c.subtle} />
                </View>
                <Txt v="h1">{m.value === null ? '—' : m.value.toLocaleString('en-IN')}</Txt>
                <Txt v="caption" color="muted">
                  {m.label}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Txt v="caption" color="muted">
            {q.data.period.from + ' — ' + q.data.period.to + ' · IST'}
          </Txt>
          {q.data.charts.map((chart) => (
            <NativeChart key={chart.key} chart={chart} />
          ))}
          <Txt v="caption" color="subtle">
            Updated {new Date(q.data.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </Txt>
        </>
      )}
    </View>
  );
}
