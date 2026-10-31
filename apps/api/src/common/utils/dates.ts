export interface DateRangeFilter {
  datePreset?: string;
  from?: string;
  to?: string;
}

export interface ResolvedDateRange {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Resolves a date preset or custom date range into UTC start and end Date objects.
 * Uses Indian Standard Time (IST, UTC+05:30) for midnight boundaries.
 */
export function resolveDateRange(preset?: string, from?: string, to?: string): ResolvedDateRange {
  if (!preset || preset === 'all' || preset === 'ALL') {
    if (!from && !to) return {};
  }

  const IST_OFFSET_MS = 5.5 * 3600_000;

  const parseUtcFromIstDateString = (dateStr: string, isEnd = false): Date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const hours = isEnd ? 23 : 0;
      const minutes = isEnd ? 59 : 0;
      const seconds = isEnd ? 59 : 0;
      const ms = isEnd ? 999 : 0;
      return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms) - IST_OFFSET_MS);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();

  const getIstDayUtc = (y: number, m: number, d: number, isEnd: boolean): Date => {
    const hours = isEnd ? 23 : 0;
    const minutes = isEnd ? 59 : 0;
    const seconds = isEnd ? 59 : 0;
    const ms = isEnd ? 999 : 0;
    return new Date(Date.UTC(y, m, d, hours, minutes, seconds, ms) - IST_OFFSET_MS);
  };

  const normalized = preset?.toLowerCase();
  switch (normalized) {
    case 'today':
      return {
        startDate: getIstDayUtc(istYear, istMonth, istDay, false),
        endDate: getIstDayUtc(istYear, istMonth, istDay, true),
      };
    case 'yesterday':
      return {
        startDate: getIstDayUtc(istYear, istMonth, istDay - 1, false),
        endDate: getIstDayUtc(istYear, istMonth, istDay - 1, true),
      };
    case 'last_7_days':
      return {
        startDate: getIstDayUtc(istYear, istMonth, istDay - 6, false),
        endDate: getIstDayUtc(istYear, istMonth, istDay, true),
      };
    case 'this_month':
      return {
        startDate: getIstDayUtc(istYear, istMonth, 1, false),
        endDate: getIstDayUtc(istYear, istMonth, istDay, true),
      };
    case 'custom':
      return {
        startDate: from ? parseUtcFromIstDateString(from, false) : undefined,
        endDate: to ? parseUtcFromIstDateString(to, true) : undefined,
      };
    default:
      if (from || to) {
        return {
          startDate: from ? parseUtcFromIstDateString(from, false) : undefined,
          endDate: to ? parseUtcFromIstDateString(to, true) : undefined,
        };
      }
      return {};
  }
}
