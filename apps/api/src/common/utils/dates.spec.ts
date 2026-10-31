import { resolveDateRange } from './dates';

describe('resolveDateRange utility', () => {
  it('returns empty object when preset is missing, all, or ALL without custom dates', () => {
    expect(resolveDateRange()).toEqual({});
    expect(resolveDateRange('all')).toEqual({});
    expect(resolveDateRange('ALL')).toEqual({});
  });

  it('resolves "today" preset to IST midnight bounds', () => {
    const { startDate, endDate } = resolveDateRange('today');
    expect(startDate).toBeDefined();
    expect(endDate).toBeDefined();

    // Verify time boundary: IST midnight is 18:30:00 UTC previous day
    const startIso = startDate!.toISOString();
    const endIso = endDate!.toISOString();
    expect(startIso.endsWith(':00.000Z')).toBe(true);
    expect(endIso.endsWith(':59.999Z')).toBe(true);

    const diffMs = endDate!.getTime() - startDate!.getTime();
    expect(diffMs).toBe(86400000 - 1); // 24 hours minus 1 ms
  });

  it('resolves "yesterday" preset to previous calendar day in IST', () => {
    const today = resolveDateRange('today');
    const yesterday = resolveDateRange('yesterday');

    expect(yesterday.startDate).toBeDefined();
    expect(yesterday.endDate).toBeDefined();

    const startDiff = today.startDate!.getTime() - yesterday.startDate!.getTime();
    expect(startDiff).toBe(86400000); // exactly 1 day earlier
  });

  it('resolves "last_7_days" preset to cover 7 full calendar days', () => {
    const today = resolveDateRange('today');
    const last7 = resolveDateRange('last_7_days');

    expect(last7.endDate!.getTime()).toBe(today.endDate!.getTime());
    const spanDays = Math.round((last7.endDate!.getTime() - last7.startDate!.getTime()) / 86400000);
    expect(spanDays).toBe(7);
  });

  it('resolves "this_month" preset starting at day 1 of current month in IST', () => {
    const thisMonth = resolveDateRange('this_month');
    const today = resolveDateRange('today');

    expect(thisMonth.endDate!.getTime()).toBe(today.endDate!.getTime());
    expect(thisMonth.startDate).toBeDefined();
    expect(thisMonth.startDate!.getTime()).toBeLessThanOrEqual(today.startDate!.getTime());
  });

  it('resolves "custom" preset with specific YYYY-MM-DD from and to strings', () => {
    const custom = resolveDateRange('custom', '2026-10-15', '2026-10-20');
    expect(custom.startDate).toBeDefined();
    expect(custom.endDate).toBeDefined();

    // 2026-10-15 00:00:00 IST is 2026-10-14 18:30:00.000 UTC
    expect(custom.startDate!.toISOString()).toBe('2026-10-14T18:30:00.000Z');
    // 2026-10-20 23:59:59.999 IST is 2026-10-20 18:29:59.999 UTC
    expect(custom.endDate!.toISOString()).toBe('2026-10-20T18:29:59.999Z');
  });

  it('handles custom ranges when preset is omitted but from/to are provided', () => {
    const range = resolveDateRange(undefined, '2026-10-01', '2026-10-05');
    expect(range.startDate?.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(range.endDate?.toISOString()).toBe('2026-10-05T18:29:59.999Z');
  });
});
