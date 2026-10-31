import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Alert,
  Linking,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  MapPin,
  LogIn,
  LogOut,
  Pause,
  Play,
  RotateCw,
  Timer,
  Navigation,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { tr } from '@/lib/i18n';
import { errorMessage } from '@/lib/api';
import { Txt } from '@/ui';
import { useTimeTrackingStore } from '@/lib/time-tracking-store';

export function TimeLoggingCard() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [punchingIn, setPunchingIn] = useState(false);
  const [punchingOut, setPunchingOut] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);

  // Zustand Store selectors
  const activeShift = useTimeTrackingStore((s) => s.activeShift);
  const isPunchedIn = useTimeTrackingStore((s) => s.isPunchedIn);
  const isPaused = useTimeTrackingStore((s) => s.isPaused);
  const pauseReason = useTimeTrackingStore((s) => s.pauseReason);
  const elapsedSeconds = useTimeTrackingStore((s) => s.elapsedSeconds);
  const todaySummary = useTimeTrackingStore((s) => s.todaySummary);
  const tickElapsed = useTimeTrackingStore((s) => s.tickElapsed);
  const punchInStore = useTimeTrackingStore((s) => s.punchIn);
  const punchOutStore = useTimeTrackingStore((s) => s.punchOut);
  const pauseShiftStore = useTimeTrackingStore((s) => s.pauseShift);
  const resumeShiftStore = useTimeTrackingStore((s) => s.resumeShift);
  const syncStatus = useTimeTrackingStore((s) => s.syncStatus);
  const loadPersistedState = useTimeTrackingStore((s) => s.loadPersistedState);

  // Status computation
  const status: 'ACTIVE' | 'PAUSED' | 'OFF_DUTY' = !isPunchedIn || !activeShift
    ? 'OFF_DUTY'
    : isPaused
    ? 'PAUSED'
    : 'ACTIVE';

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, [loadPersistedState]);

  // Periodic server sync via React Query
  const {
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['time-logging-status'],
    queryFn: async () => {
      await syncStatus();
      return useTimeTrackingStore.getState();
    },
    refetchInterval: 30_000,
    enabled: !!user,
  });

  // Live timer tick every 1000ms while active
  useEffect(() => {
    if (status !== 'ACTIVE') return;
    const interval = setInterval(() => {
      tickElapsed();
    }, 1000);
    return () => clearInterval(interval);
  }, [status, tickElapsed]);

  // Formatter for live timer display: HH:MM:SS
  const timerDisplay = useMemo(() => {
    const totalSecs = Math.max(0, elapsedSeconds);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }, [elapsedSeconds]);

  // Formatter for minute counts into "Xh Ym"
  const formatMinutes = (mins?: number | null) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Formatter for time string (hh:mm A)
  const formatTimeOnly = (isoStr?: string | Date | null) => {
    if (!isoStr) return '—';
    try {
      const d = typeof isoStr === 'string' ? new Date(isoStr) : isoStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  // Punch In Action with Mandatory GPS Check
  const handlePunchIn = async () => {
    setPunchingIn(true);
    try {
      // 1. Mandatory Location Services Check
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          tr('GPS Disabled'),
          tr('Please enable Location / GPS services on your device to punch in.'),
          [{ text: tr('OK') }]
        );
        return;
      }

      // 2. Mandatory Location Permission Check
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      let finalStatus = existingStatus;

      if (finalStatus !== Location.PermissionStatus.GRANTED) {
        const { status: requestedStatus } = await Location.requestForegroundPermissionsAsync();
        finalStatus = requestedStatus;
      }

      if (finalStatus !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          tr('Location Permission Mandatory'),
          tr('Agency shift tracking requires foreground GPS location to record attendance. Please enable location access in settings.'),
          [
            { text: tr('Cancel'), style: 'cancel' },
            { text: tr('Open Settings'), onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // 3. Delegate to store punchIn
      await punchInStore();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(tr('Punched in successfully! Shift started.'));
      qc.invalidateQueries({ queryKey: ['time-logging-status'] });
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(tr('Punch In Failed'), err.message || errorMessage(err));
    } finally {
      setPunchingIn(false);
    }
  };

  // Punch Out Action with confirmation dialog
  const handlePunchOut = () => {
    Alert.alert(
      tr('End Shift & Punch Out?'),
      tr('Are you sure you want to punch out? Total active shift duration: ') + timerDisplay,
      [
        { text: tr('Cancel'), style: 'cancel' },
        {
          text: tr('Punch Out'),
          style: 'destructive',
          onPress: async () => {
            setPunchingOut(true);
            try {
              await punchOutStore();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              toast.success(tr('Shift completed. Punched out successfully!'));
              qc.invalidateQueries({ queryKey: ['time-logging-status'] });
            } catch (err: any) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              Alert.alert(tr('Punch Out Failed'), err.message || errorMessage(err));
            } finally {
              setPunchingOut(false);
            }
          },
        },
      ]
    );
  };

  // Pause Shift Action
  const handlePause = async () => {
    if (!activeShift?.id) return;
    setPausing(true);
    try {
      await pauseShiftStore('MANUAL_BREAK');
      await Haptics.selectionAsync().catch(() => {});
      toast.info(tr('Shift paused for break.'));
      qc.invalidateQueries({ queryKey: ['time-logging-status'] });
    } catch (err: any) {
      Alert.alert(tr('Pause Failed'), err.message || errorMessage(err));
    } finally {
      setPausing(false);
    }
  };

  // Resume Shift Action
  const handleResume = async () => {
    if (!activeShift?.id) return;
    setResuming(true);
    try {
      await resumeShiftStore('MANUAL');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(tr('Shift resumed. Live tracking active!'));
      qc.invalidateQueries({ queryKey: ['time-logging-status'] });
    } catch (err: any) {
      Alert.alert(tr('Resume Failed'), err.message || errorMessage(err));
    } finally {
      setResuming(false);
    }
  };

  // Render Skeleton while initial query loads if store has no shift
  if (isLoading && !activeShift && !todaySummary) {
    return (
      <View
        style={{
          borderRadius: 24,
          padding: 18,
          backgroundColor: isDark ? '#13172C' : '#FFFFFF',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(99,102,241,0.2)' : c.line,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 4 }}>
            <View style={{ width: 140, height: 16, borderRadius: 6, backgroundColor: isDark ? '#1C2033' : '#E2E8F0' }} />
            <View style={{ width: 100, height: 12, borderRadius: 4, backgroundColor: isDark ? '#1C2033' : '#F1F5F9' }} />
          </View>
          <View style={{ width: 70, height: 24, borderRadius: 999, backgroundColor: isDark ? '#1C2033' : '#E2E8F0' }} />
        </View>
        <View style={{ height: 50, borderRadius: 14, backgroundColor: isDark ? '#1C2033' : '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={c.brand} />
        </View>
      </View>
    );
  }

  // Determine badge presentation
  const badgeConfig = {
    ACTIVE: {
      label: 'ON DUTY',
      color: '#10B981',
      bg: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.35)',
      dotColor: '#10B981',
    },
    PAUSED: {
      label: 'ON BREAK',
      color: '#F59E0B',
      bg: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.35)',
      dotColor: '#F59E0B',
    },
    OFF_DUTY: {
      label: 'OFF DUTY',
      color: isDark ? '#94A3B8' : '#64748B',
      bg: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.1)',
      border: isDark ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.2)',
      dotColor: isDark ? '#94A3B8' : '#64748B',
    },
  }[status];

  return (
    <View
      style={{
        borderRadius: 24,
        padding: 18,
        backgroundColor: isDark ? '#13172C' : '#FFFFFF',
        borderWidth: 1,
        borderColor:
          status === 'ACTIVE'
            ? (isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.4)')
            : status === 'PAUSED'
            ? (isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.4)')
            : (isDark ? 'rgba(99,102,241,0.2)' : c.line),
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
        gap: 14,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color={status === 'ACTIVE' ? '#10B981' : status === 'PAUSED' ? '#F59E0B' : c.brand} />
            <Txt style={{ fontSize: 16, fontWeight: '800', color: c.fg }}>
              Time & Shift Attendance
            </Txt>
          </View>
          <Txt v="caption" color="muted">
            {status === 'ACTIVE'
              ? 'GPS-verified live duty session'
              : status === 'PAUSED'
              ? pauseReason === 'GPS_SIGNAL_LOST'
                ? 'Auto-paused: GPS location lost'
                : 'Shift paused · Take break'
              : 'Mandatory GPS location to punch in'}
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => refetch()}
            disabled={isRefetching}
            accessibilityLabel="Refresh attendance status"
            style={{
              padding: 6,
              borderRadius: 10,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface2,
            }}
          >
            <RotateCw size={14} color={c.muted} style={{ opacity: isRefetching ? 0.4 : 1 }} />
          </TouchableOpacity>

          {/* Status Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: badgeConfig.bg,
              borderWidth: 1,
              borderColor: badgeConfig.border,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: badgeConfig.dotColor,
              }}
            />
            <Txt style={{ color: badgeConfig.color, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
              {badgeConfig.label}
            </Txt>
          </View>
        </View>
      </View>

      {/* Main Content Area based on Status */}
      {status === 'ACTIVE' && (
        <View style={{ gap: 12 }}>
          {/* Live Duration Display */}
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)',
            }}
          >
            <Txt
              style={{
                fontSize: 34,
                fontWeight: '900',
                color: isDark ? '#34D399' : '#059669',
                fontVariant: ['tabular-nums'],
                letterSpacing: 1,
              }}
            >
              {timerDisplay}
            </Txt>
            <Txt v="caption" style={{ color: isDark ? '#34D399' : '#059669', fontWeight: '700', marginTop: 2 }}>
              ● Live Active Shift Time
            </Txt>
          </View>

          {/* Shift Details Grid */}
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 16,
              backgroundColor: isDark ? '#181C30' : c.surface2,
              padding: 12,
              gap: 12,
            }}
          >
            {/* Punch In Time */}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <LogIn size={13} color={c.brand} />
                <Txt v="caption" color="muted">
                  Punch In
                </Txt>
              </View>
              <Txt style={{ fontWeight: '800', fontSize: 14, color: c.fg }}>
                {formatTimeOnly(activeShift?.punchInAt)}
              </Txt>
            </View>

            <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.line }} />

            {/* Today Total */}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Timer size={13} color={c.brand} />
                <Txt v="caption" color="muted">
                  Today's Total
                </Txt>
              </View>
              <Txt style={{ fontWeight: '800', fontSize: 14, color: c.fg }}>
                {formatMinutes(todaySummary?.activeMinutes)}
              </Txt>
            </View>
          </View>

          {/* Punch In Location Box */}
          {(activeShift?.punchInAddress || (activeShift?.punchInLat && activeShift?.punchInLng)) && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                padding: 10,
                borderRadius: 14,
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.05)' : c.line,
              }}
            >
              <MapPin size={15} color={c.danger} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
                  Punch-In Location
                </Txt>
                <Txt v="small" style={{ color: c.fg, fontWeight: '600' }} numberOfLines={2}>
                  {activeShift?.punchInAddress ||
                    `${activeShift?.punchInLat?.toFixed(4)}, ${activeShift?.punchInLng?.toFixed(4)}`}
                </Txt>
              </View>
            </View>
          )}

          {/* Actions: Pause & Punch Out */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={handlePause}
              disabled={pausing || punchingOut}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.3)',
              }}
            >
              {pausing ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <>
                  <Pause size={16} color="#F59E0B" />
                  <Txt style={{ color: '#F59E0B', fontWeight: '800', fontSize: 14 }}>
                    Take Break
                  </Txt>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePunchOut}
              disabled={punchingOut || pausing}
              style={{
                flex: 1.2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: c.danger,
              }}
            >
              {punchingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <LogOut size={16} color="#fff" />
                  <Txt style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    Punch Out
                  </Txt>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'PAUSED' && (
        <View style={{ gap: 12 }}>
          {/* Paused Display */}
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
            }}
          >
            <Txt
              style={{
                fontSize: 34,
                fontWeight: '900',
                color: '#F59E0B',
                fontVariant: ['tabular-nums'],
                letterSpacing: 1,
              }}
            >
              {timerDisplay}
            </Txt>
            <Txt v="caption" style={{ color: '#F59E0B', fontWeight: '700', marginTop: 2 }}>
              {pauseReason === 'GPS_SIGNAL_LOST'
                ? '⚠️ Shift Auto-Paused · GPS Signal Lost'
                : '⏸ Shift Paused · Break in Progress'}
            </Txt>
          </View>

          {/* Details Row */}
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 16,
              backgroundColor: isDark ? '#181C30' : c.surface2,
              padding: 12,
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="caption" color="muted">
                Punched In At
              </Txt>
              <Txt style={{ fontWeight: '800', fontSize: 14, color: c.fg }}>
                {formatTimeOnly(activeShift?.punchInAt)}
              </Txt>
            </View>
            <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.line }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="caption" color="muted">
                Today Total
              </Txt>
              <Txt style={{ fontWeight: '800', fontSize: 14, color: c.fg }}>
                {formatMinutes(todaySummary?.activeMinutes)}
              </Txt>
            </View>
          </View>

          {/* Actions: Resume & Punch Out */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={handleResume}
              disabled={resuming || punchingOut}
              style={{
                flex: 1.2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: '#10B981',
              }}
            >
              {resuming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Play size={16} color="#fff" />
                  <Txt style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    Resume Shift
                  </Txt>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePunchOut}
              disabled={punchingOut || resuming}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: isDark ? 'rgba(244,63,94,0.12)' : 'rgba(244,63,94,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(244,63,94,0.25)',
              }}
            >
              {punchingOut ? (
                <ActivityIndicator size="small" color={c.danger} />
              ) : (
                <>
                  <LogOut size={16} color={c.danger} />
                  <Txt style={{ color: c.danger, fontWeight: '800', fontSize: 14 }}>
                    Punch Out
                  </Txt>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'OFF_DUTY' && (
        <View style={{ gap: 14 }}>
          {/* Summary / Stats Callout */}
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              backgroundColor: isDark ? '#181C30' : c.surface2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
                Today's Work Summary ({todaySummary?.date || 'Today'})
              </Txt>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                }}
              >
                <Txt v="caption" style={{ fontSize: 10, fontWeight: '700', color: c.fg }}>
                  {todaySummary?.shiftsCount ?? 0} {todaySummary?.shiftsCount === 1 ? 'Shift' : 'Shifts'}
                </Txt>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ gap: 2 }}>
                <Txt v="caption" color="muted">
                  Total Active Time
                </Txt>
                <Txt style={{ fontSize: 18, fontWeight: '900', color: c.fg }}>
                  {formatMinutes(todaySummary?.activeMinutes)}
                </Txt>
              </View>

              <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.line }} />

              <View style={{ gap: 2 }}>
                <Txt v="caption" color="muted">
                  Break Time
                </Txt>
                <Txt style={{ fontSize: 18, fontWeight: '900', color: c.muted }}>
                  {formatMinutes(todaySummary?.pausedMinutes)}
                </Txt>
              </View>
            </View>
          </View>

          {/* Mandatory GPS Note */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
            }}
          >
            <Navigation size={14} color={c.brand} />
            <Txt v="caption" color="muted" style={{ flex: 1, fontSize: 11 }}>
              Agency policy: Current GPS coordinates will be captured and verified upon punch in.
            </Txt>
          </View>

          {/* Punch In Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePunchIn}
            disabled={punchingIn}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 15,
              borderRadius: 16,
              backgroundColor: '#10B981',
              shadowColor: '#10B981',
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {punchingIn ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Txt style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                  Verifying GPS Location...
                </Txt>
              </>
            ) : (
              <>
                <LogIn size={18} color="#FFFFFF" />
                <Txt style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                  Punch In (Start Shift)
                </Txt>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
