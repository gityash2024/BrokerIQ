import { z } from 'zod';

export const followUpQuerySchema = z
  .object({
    status: z.enum(['PENDING', 'DONE', 'MISSED', 'CANCELLED']).optional(),
    view: z.enum(['today', 'overdue', 'upcoming', 'all']).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    assignedToId: z.string().min(1).max(100).optional(),
    search: z.string().trim().max(200).optional(),
    paginated: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).max(21474836).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
    sortBy: z.enum(['dueAt', 'createdAt', 'completedAt']).default('dueAt'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && Date.parse(value.from) > Date.parse(value.to))
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'End date must be after the start date' });
  });
export type FollowUpQuery = z.infer<typeof followUpQuerySchema>;

const IST = 330 * 60000;
export function followUpIstDayEnd(now = new Date()): Date {
  const shifted = new Date(now.getTime() + IST);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - IST - 1);
}
export function followUpTomorrowAtTen(now = new Date()): Date {
  return new Date(followUpIstDayEnd(now).getTime() + 1 + 10 * 3600000);
}

/** Inclusive IST calendar-date filter; invalid calendar days never silently roll over. */
export function followUpDateBoundary(day: string, end = false): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  if (year < 1900 || year > 9999) return null;
  const value = new Date(Date.UTC(year, month - 1, date));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== date) return null;
  return new Date(value.getTime() - IST + (end ? 86400000 - 1 : 0)).toISOString();
}
