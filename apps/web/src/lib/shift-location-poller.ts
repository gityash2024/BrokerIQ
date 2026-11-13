/** Stationary browsers need explicit polling: watchPosition may never emit another fix. */
export function startShiftLocationPolling(
  geolocation: Pick<Geolocation, 'getCurrentPosition'>,
  report: (position: GeolocationPosition) => Promise<void>,
  intervalMs: number,
  schedule: typeof setInterval = setInterval,
  cancel: typeof clearInterval = clearInterval,
) {
  let stopped = false;
  let busy = false;
  const poll = () => {
    if (stopped || busy) return;
    busy = true;
    geolocation.getCurrentPosition(
      (position) => {
        if (stopped) { busy = false; return; }
        // Preserve actual fix time. A cached or future coordinate cannot masquerade as fresh.
        const age = Date.now() - position.timestamp;
        if (!Number.isFinite(age) || age < -60_000 || age > 30_000) { busy = false; return; }
        void report(position).catch(() => undefined).finally(() => { busy = false; });
      },
      () => { busy = false; },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 15_000 },
    );
  };
  poll();
  const timer = schedule(poll, intervalMs);
  return { poll, stop: () => { stopped = true; cancel(timer); } };
}
