import { z } from 'zod';

export const punchInSchema = z.object({
  latitude: z.number().min(-90).max(90, { message: 'Latitude must be between -90 and 90' }),
  longitude: z.number().min(-180).max(180, { message: 'Longitude must be between -180 and 180' }),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
export type PunchInDto = z.infer<typeof punchInSchema>;

export const punchOutSchema = z.object({
  shiftId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
export type PunchOutDto = z.infer<typeof punchOutSchema>;

export const locationUpdateSchema = z.object({
  shiftId: z.string().optional(),
  latitude: z.number().min(-90).max(90, { message: 'Latitude must be between -90 and 90' }),
  longitude: z.number().min(-180).max(180, { message: 'Longitude must be between -180 and 180' }),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  source: z.string().max(50).optional(),
});
export type LocationUpdateDto = z.infer<typeof locationUpdateSchema>;

export const pauseShiftSchema = z.object({
  shiftId: z.string().optional(),
  reason: z.string().min(1, { message: 'Pause reason is required' }).max(200),
});
export type PauseShiftDto = z.infer<typeof pauseShiftSchema>;

export const resumeShiftSchema = z.object({
  shiftId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
export type ResumeShiftDto = z.infer<typeof resumeShiftSchema>;

export const timelineQuerySchema = z.object({
  agentId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in format YYYY-MM-DD' }).optional(),
});
export type TimelineQueryDto = z.infer<typeof timelineQuerySchema>;

export const historyQuerySchema = z.object({
  agentId: z.string().optional(),
  shiftId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in format YYYY-MM-DD' }).optional(),
});
export type HistoryQueryDto = z.infer<typeof historyQuerySchema>;

export const summaryQuerySchema = z.object({
  brokerId: z.string().optional(),
  agentId: z.string().optional(),
  datePreset: z.enum(['today', 'yesterday', 'last_7_days', 'this_month', 'custom']).optional().default('today'),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type SummaryQueryDto = z.infer<typeof summaryQuerySchema>;

export interface TimelineEvent {
  id: string;
  type: 'PUNCH_IN' | 'CHECKPOINT' | 'PAUSE' | 'RESUME' | 'PUNCH_OUT';
  timestamp: string;
  label: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  address?: string | null;
  durationMinutes?: number;
  reason?: string | null;
}
