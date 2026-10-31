'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Pause,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  User,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import type { MapPoint } from '@/components/site/map';
import type { BrokerTeamResponse } from '@brokeriq/shared';

// Dynamic Leaflet map import with { ssr: false } to eliminate window reference exceptions
const DynamicMap = dynamic(
  () => import('@/components/site/map').then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full min-h-[460px] items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          Loading location history map...
        </div>
      </div>
    ),
  }
);

/** Helper to obtain current date string in IST format (YYYY-MM-DD) */
function getTodayIst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Formats minute counts into "Xh Ym" */
function formatMinutes(mins?: number | null): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Formats timestamp string into time-of-day in IST */
function formatTimeOnly(isoStr?: string | Date | null): string {
  if (!isoStr) return '—';
  try {
    const d = typeof isoStr === 'string' ? new Date(isoStr) : isoStr;
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

interface TimelineEvent {
  id: string;
  type: 'PUNCH_IN' | 'CHECKPOINT' | 'PAUSE' | 'RESUME' | 'PUNCH_OUT';
  timestamp: string;
  label: string;
  coordinates?: { latitude: number; longitude: number; accuracy?: number | null };
  address?: string | null;
  durationMinutes?: number;
  reason?: string | null;
}

interface TimelineResponse {
  agent: { id: string; name: string; email: string; role: any; avatarUrl: string | null };
  date: string;
  shifts: any[];
  events: TimelineEvent[];
  summary: {
    activeMinutes: number;
    pausedMinutes: number;
    checkpointsCount: number;
  };
}

interface HistoryResponse {
  agentId: string;
  date: string;
  points: Array<{
    id: string;
    shiftId: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    address: string | null;
    source: string;
    capturedAt: string;
  }>;
  count: number;
}

interface StatusResponse {
  activeShift: {
    id: string;
    punchInAt: string;
    status: 'ACTIVE' | 'PAUSED';
    pauseReason?: string;
    currentMinutes: number;
    punchInAddress?: string;
  } | null;
  status: 'ACTIVE' | 'PAUSED' | 'OFF_DUTY';
  todaySummary: {
    date: string;
    activeMinutes: number;
    pausedMinutes: number;
    checkpoints: number;
    shiftsCount: number;
  };
  lastKnownLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    address: string | null;
    capturedAt: string;
  } | null;
}

function TimeLoggingContent() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Filters State
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIst());
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // 1. Fetch broker firms if Super Admin
  const brokersQuery = useQuery({
    queryKey: ['admin-organizations-time-logging'],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>('/admin/organizations?limit=100'),
    enabled: isSuperAdmin,
  });

  // 2. Fetch team members (with optional orgId override for Super Admin)
  const teamQuery = useQuery({
    queryKey: ['broker-team-time-logging', selectedBrokerId],
    queryFn: () => api<BrokerTeamResponse>(`/broker/team${qs({ orgId: selectedBrokerId || undefined })}`),
  });

  const members = teamQuery.data?.members ?? [];

  // Active agent: fallback to first member if none selected
  const activeAgentId = selectedAgentId || (members.length > 0 ? members[0].id : user?.id || '');
  const activeAgent = members.find((m) => m.id === activeAgentId);

  // 3. Fetch agent status (duty state, active shift)
  const statusQuery = useQuery({
    queryKey: ['time-logging-status', activeAgentId],
    queryFn: () => api<StatusResponse>(`/time-logging/status${qs({ agentId: activeAgentId })}`),
    enabled: !!activeAgentId,
    refetchInterval: 15_000,
  });

  // 4. Fetch daily timeline events
  const timelineQuery = useQuery({
    queryKey: ['time-logging-timeline', activeAgentId, selectedDate],
    queryFn: () => api<TimelineResponse>(`/time-logging/timeline${qs({ agentId: activeAgentId, date: selectedDate })}`),
    enabled: !!activeAgentId && !!selectedDate,
  });

  // 5. Fetch 15-minute location history points
  const historyQuery = useQuery({
    queryKey: ['time-logging-history', activeAgentId, selectedDate],
    queryFn: () => api<HistoryResponse>(`/time-logging/history${qs({ agentId: activeAgentId, date: selectedDate })}`),
    enabled: !!activeAgentId && !!selectedDate,
  });

  const timelineData = timelineQuery.data;
  const historyData = historyQuery.data;
  const statusData = statusQuery.data;

  // Format map points with numbered sequence waypoint badges
  const mapPoints: MapPoint[] = useMemo(() => {
    return (historyData?.points ?? []).map((p, idx) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      label: String(idx + 1), // Numbered sequence waypoint pin
      sublabel: formatTimeOnly(p.capturedAt),
      address: p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}${p.accuracy ? ` (±${Math.round(p.accuracy)}m)` : ''}`,
    }));
  }, [historyData?.points]);

  // Coordinates polyline connecting breadcrumbs in chronological order
  const polylineCoords: [number, number][] = useMemo(() => {
    return (historyData?.points ?? []).map((p) => [p.latitude, p.longitude]);
  }, [historyData?.points]);

  // Timestamps calculations
  const firstPunchIn = timelineData?.events?.find((e) => e.type === 'PUNCH_IN')?.timestamp;
  const lastPunchOut = [...(timelineData?.events ?? [])].reverse().find((e) => e.type === 'PUNCH_OUT')?.timestamp;

  const handleRefresh = () => {
    timelineQuery.refetch();
    historyQuery.refetch();
    statusQuery.refetch();
  };

  const setPresetToday = () => setSelectedDate(getTodayIst());
  const setPresetYesterday = () => {
    const yesterday = new Date(Date.now() - 86400_000);
    setSelectedDate(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(yesterday)
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Logging & Location History"
        subtitle="Monitor agent working hours, 15-minute breadcrumb coordinates, shift status, and daily activity timelines"
      />

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Superadmin Broker Filter */}
          {isSuperAdmin && (
            <div className="w-56">
              <Select
                className="h-10 text-xs font-semibold"
                value={selectedBrokerId}
                onChange={(e) => {
                  setSelectedBrokerId(e.target.value);
                  setSelectedAgentId('');
                }}
              >
                <option value="">All Broker Firms (Default)</option>
                {(brokersQuery.data?.items ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Agent Dropdown Selector */}
          <div className="w-60">
            <Select
              className="h-10 text-xs font-semibold"
              value={activeAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              {members.length === 0 ? (
                <option value="">No agents found</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})
                  </option>
                ))
              )}
            </Select>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-fg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={setPresetToday}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                  selectedDate === getTodayIst()
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-2 text-muted hover:text-fg'
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={setPresetYesterday}
                className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-fg transition"
              >
                Yesterday
              </button>
            </div>
          </div>
        </div>

        {/* Refresh Action */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          className="gap-2 text-xs"
          disabled={timelineQuery.isFetching || historyQuery.isFetching}
        >
          <RefreshCw className={cn('size-3.5', (timelineQuery.isFetching || historyQuery.isFetching) && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Working Hours Summary Cards Deck */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Duty Status */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Current Duty Status</span>
            <div className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
              <User className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {statusQuery.isLoading ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : statusData?.status === 'ACTIVE' ? (
              <Badge tone="success" className="px-3 py-1 text-xs uppercase font-bold tracking-wide">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping inline-block mr-1.5" />
                ON DUTY
              </Badge>
            ) : statusData?.status === 'PAUSED' ? (
              <Badge tone="warning" className="px-3 py-1 text-xs uppercase font-bold tracking-wide">
                <Pause className="size-3 mr-1" />
                PAUSED ({statusData.activeShift?.pauseReason || 'GPS Lost'})
              </Badge>
            ) : (
              <Badge tone="neutral" className="px-3 py-1 text-xs uppercase font-bold tracking-wide">
                OFF DUTY
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-subtle truncate">
            {activeAgent?.name ? `${activeAgent.name}` : 'Selected Agent'}
          </p>
        </div>

        {/* Card 2: Total Active Hours */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Working Hours</span>
            <div className="grid size-8 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {timelineQuery.isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold font-display text-fg">
                {formatMinutes(timelineData?.summary?.activeMinutes ?? 0)}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs text-subtle">Total accumulated active shift time</p>
        </div>

        {/* Card 3: Total Paused Duration */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Paused / Suspended</span>
            <div className="grid size-8 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10">
              <PauseCircle className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {timelineQuery.isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">
                {formatMinutes(timelineData?.summary?.pausedMinutes ?? 0)}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs text-subtle">Interruption / GPS lost duration</p>
        </div>

        {/* Card 4: Punch In & Out Timestamps */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Punches & GPS Points</span>
            <div className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10">
              <MapPin className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-subtle block">Punch In</span>
              <span className="font-bold text-fg">{formatTimeOnly(firstPunchIn)}</span>
            </div>
            <div className="text-right">
              <span className="text-subtle block">Punch Out</span>
              <span className="font-bold text-fg">
                {lastPunchOut ? formatTimeOnly(lastPunchOut) : statusData?.status === 'ACTIVE' ? 'In Progress' : '—'}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-400">
            {historyData?.count ?? 0} breadcrumbs captured
          </div>
        </div>
      </div>

      {/* 2-Column Split Dashboard (Timeline + Leaflet Map) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Daily Chronological Timeline (5 of 12 cols) */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-display font-bold text-fg">Daily Timeline</h3>
              <p className="text-xs text-muted">Chronological shift events & breadcrumbs</p>
            </div>
            <Badge tone="brand" className="text-[11px]">
              {timelineData?.events?.length ?? 0} events
            </Badge>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto max-h-[640px] pr-2">
            {timelineQuery.isLoading ? (
              <div className="space-y-4 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : !timelineData?.events || timelineData.events.length === 0 ? (
              <Empty
                icon={<Clock className="size-6 text-muted" />}
                title="No timeline events"
                text="No shift activity or GPS breadcrumbs recorded for this agent on the selected date."
                className="my-8"
              />
            ) : (
              <div className="relative border-l-2 border-line/80 ml-4 space-y-6 py-2">
                {timelineData.events.map((evt) => {
                  const isCheckpoint = evt.type === 'CHECKPOINT';
                  const isPunchIn = evt.type === 'PUNCH_IN';
                  const isPunchOut = evt.type === 'PUNCH_OUT';
                  const isPause = evt.type === 'PAUSE';
                  const isResume = evt.type === 'RESUME';

                  return (
                    <div
                      key={evt.id}
                      onClick={() => isCheckpoint && setSelectedPointId(evt.id.replace('loc-', ''))}
                      className={cn(
                        'relative pl-6 transition-colors group',
                        isCheckpoint && 'cursor-pointer'
                      )}
                    >
                      {/* Node Circle Icon */}
                      <span
                        className={cn(
                          'absolute -left-[17px] top-1 grid size-8 place-items-center rounded-full border-2 border-surface shadow-sm transition-transform group-hover:scale-110',
                          isPunchIn && 'bg-emerald-600 text-white',
                          isCheckpoint && 'bg-sky-600 text-white',
                          isPause && 'bg-amber-600 text-white',
                          isResume && 'bg-indigo-600 text-white',
                          isPunchOut && 'bg-rose-600 text-white'
                        )}
                      >
                        {isPunchIn && <LogIn className="size-3.5" />}
                        {isCheckpoint && <MapPin className="size-3.5" />}
                        {isPause && <Pause className="size-3.5" />}
                        {isResume && <PlayCircle className="size-3.5" />}
                        {isPunchOut && <LogOut className="size-3.5" />}
                      </span>

                      {/* Event Details Card */}
                      <div
                        className={cn(
                          'rounded-xl border border-line/70 bg-surface-2/40 p-3 transition hover:bg-surface-2',
                          selectedPointId && evt.id.includes(selectedPointId) && 'ring-2 ring-brand-500 bg-brand-50/20'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-fg">{evt.label}</span>
                          <span className="text-[11px] font-semibold text-subtle">
                            {formatTimeOnly(evt.timestamp)}
                          </span>
                        </div>

                        {/* Coordinates or Address */}
                        {(evt.address || evt.coordinates) && (
                          <p className="mt-1 text-[11px] text-muted line-clamp-2">
                            {evt.address || `${evt.coordinates?.latitude.toFixed(5)}, ${evt.coordinates?.longitude.toFixed(5)}`}
                            {evt.coordinates?.accuracy ? ` (±${Math.round(evt.coordinates.accuracy)}m)` : ''}
                          </p>
                        )}

                        {/* Duration or Reason Badges */}
                        {isPause && evt.reason && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              Reason: {evt.reason}
                            </span>
                            {evt.durationMinutes ? (
                              <span className="text-[10px] text-subtle">
                                Duration: {evt.durationMinutes}m
                              </span>
                            ) : null}
                          </div>
                        )}

                        {isPunchOut && evt.durationMinutes ? (
                          <div className="mt-2">
                            <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                              Shift duration: {formatMinutes(evt.durationMinutes)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 15-Minute Location History Map (7 of 12 cols) */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-display font-bold text-fg">15-Minute Location History Map</h3>
              <p className="text-xs text-muted">Chronological route trace & numbered waypoint markers</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-subtle">
                <span className="size-2 rounded-full bg-brand-600" />
                Route Polyline
              </span>
              <Badge tone="info" className="text-[11px]">
                {mapPoints.length} Waypoints
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex-1 min-h-[500px] w-full overflow-hidden rounded-xl border border-line relative">
            {historyQuery.isLoading ? (
              <div className="flex h-full w-full min-h-[500px] items-center justify-center bg-surface-2 text-muted">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  Loading GPS breadcrumbs...
                </div>
              </div>
            ) : mapPoints.length === 0 ? (
              <div className="flex h-full w-full min-h-[500px] flex-col items-center justify-center bg-surface-2/60 p-6 text-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 mb-3">
                  <Navigation className="size-6" />
                </div>
                <h4 className="font-display font-bold text-fg">No GPS breadcrumbs recorded</h4>
                <p className="mt-1 max-w-sm text-xs text-muted">
                  No 15-minute location history points were logged for this agent on {selectedDate}.
                </p>
              </div>
            ) : (
              <DynamicMap
                points={mapPoints}
                polyline={polylineCoords}
                activeId={selectedPointId}
                onSelect={(p) => setSelectedPointId(p.id)}
                className="h-full min-h-[500px] w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimeLoggingPage() {
  return (
    <RequireAuth roles={['BROKER_ADMIN', 'SUPER_ADMIN']}>
      <TimeLoggingContent />
    </RequireAuth>
  );
}
