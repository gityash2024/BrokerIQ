# Ten-minute shift location refresh

Status: source verified; not included in public Build 61. Physical Android acceptance remains deferred.

The previous native and foreground schedules requested fifteen minutes. Browser `watchPosition` could remain silent while stationary. Admin timeline/history queries had no periodic refetch, even though status refreshed. An existing native task registration could also survive an upgrade with its older options.

The shared ten-minute interval now drives native capture, foreground fallback, and authorized history refresh. Existing native registrations without the new cadence marker are restarted once. Web explicitly requests a fresh fix on a timer and on visibility/network recovery, and rejects stale fixes. Mobile refreshes history on route focus and app foreground. Super Admin selection remains explicit; other agents' records remain protected by existing API role and firm boundaries. Manual pause, logout, capture timestamps and the account-bound offline queue are preserved.

Validation: 45 mobile tests across native registration, timer boundaries, pause and offline queue; 28 API unit/real PostgreSQL tests for state transitions, provenance, duplicate replay and ownership; two browser poller tests for stationary capture, stale fixes and cleanup. Web/mobile TypeScript checks passed. These checks do not prove Android battery restrictions, process death, background permissions or GPS delivery on a physical device.

Native OS delivery is a requested cadence, not a guaranteed wall-clock schedule. Historical coordinates retain their actual captured time and are not labelled as a new live fix merely because the screen refreshed.

The final source also adds an explicitly scoped native Super Admin read-only monitor: login opens Time Logging; member selection spans firms with organization labels. Other native platform routes remain denied, the module policy still applies, and platform administration stays on responsive web. Sign-out remains available even on a restricted screen. Web and mobile member detail queries now refresh every ten minutes; native details also refetch on focus/foreground. Account keys, unsaved editor fields and conflict detection are preserved.
