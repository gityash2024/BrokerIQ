import { z } from 'zod';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Invalid calendar date');
export const dashboardQuerySchema = z
  .object({ days: z.coerce.number().int().min(1).max(366).default(30), from: date.optional(), to: date.optional() })
  .refine((q) => !!q.from === !!q.to, 'Provide both dates')
  .refine((q) => !q.from || !q.to || (q.from <= q.to && (Date.parse(q.to) - Date.parse(q.from)) / 86400000 < 366), 'Choose up to 366 days');
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export function dashboardMonthPeriod(day: string) {
  const valid = date.parse(day);
  const [year, month] = valid.slice(0, 7).split('-').map(Number);
  return { month: valid.slice(0, 7), start: new Date(Date.UTC(year, month - 1, 1) - 330 * 60_000), end: new Date(Date.UTC(year, month, 1) - 330 * 60_000) };
}
export const performanceQuerySchema = z
  .object({
    range: z.enum(['MONTH', 'QUARTER', 'YEAR', 'ALL', 'CUSTOM']).default('MONTH'),
    from: date.optional(),
    to: date.optional(),
    organizationId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.range === 'CUSTOM' && !dashboardQuerySchema.safeParse({ from: value.from, to: value.to }).success) ||
      (value.range === 'CUSTOM' && (!value.from || !value.to))
    )
      ctx.addIssue({ code: 'custom', message: 'Choose a valid custom date range up to 366 days' });
  });
export type PerformanceQuery = z.infer<typeof performanceQuerySchema>;
export interface PerformanceData {
  scope: 'SELF' | 'FIRM' | 'ALL_FIRMS';
  period: { from: string; to: string; timezone: string };
  targetMonth: string;
  definition: string;
  items: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
    organizationId: string | null;
    organizationName?: string;
    rank: number | null;
    wonLeads: number;
    activities: number;
    receivedLeads: number;
    monthlyWonLeads: number;
    targets: { monthlyDeals?: number; monthlyLeads?: number; monthlyRevenue?: number; commissionPct?: number };
    monthlyFulfillment: number | null;
  }[];
}
export function dashboardPeriod(q: DashboardQuery, now = new Date()) {
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  const to = q.to ?? today;
  const from = q.from ?? new Date(Date.parse(to) - (q.days - 1) * 86400000).toISOString().slice(0, 10);
  if (to > today) throw new Error('Future reporting dates are not supported');
  return { from, to, start: new Date(from + 'T00:00:00+05:30'), end: new Date(Date.parse(to + 'T00:00:00+05:30') + 86400000) };
}
export interface DashboardPoint {
  key: string;
  label: string;
  value: number;
  href: string;
}
export interface DashboardChart {
  key: string;
  title: string;
  kind: 'line' | 'bar' | 'donut';
  scope: 'current' | 'period';
  points: DashboardPoint[];
}
export interface DashboardMetric {
  key: string;
  label: string;
  value: number | string | null;
  href: string;
  definition: string;
}
export interface DashboardData {
  role: 'admin' | 'broker' | 'user';
  generatedAt: string;
  period: { from: string; to: string; timezone: 'Asia/Kolkata' };
  metrics: DashboardMetric[];
  charts: DashboardChart[];
  integrations?: { key: string; name: string; configured: boolean; tested: boolean }[];
}
