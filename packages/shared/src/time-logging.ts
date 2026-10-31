import { z } from 'zod';
import { ShiftStatus } from './enums';

export const punchInRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
export type PunchInRequest = z.infer<typeof punchInRequestSchema>;

export const punchOutRequestSchema = z.object({
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
export type PunchOutRequest = z.infer<typeof punchOutRequestSchema>;

export const recordLocationRequestSchema = z.object({
  shiftId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  source: z.string().max(50).optional(),
});
export type RecordLocationRequest = z.infer<typeof recordLocationRequestSchema>;

export const pauseShiftRequestSchema = z.object({
  shiftId: z.string().min(1),
  reason: z.string().max(255).optional().default('MANUAL'),
});
export type PauseShiftRequest = z.infer<typeof pauseShiftRequestSchema>;

export const resumeShiftRequestSchema = z.object({
  shiftId: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().positive().optional().nullable(),
});
export type ResumeShiftRequest = z.infer<typeof resumeShiftRequestSchema>;

export const shiftIntervalSchema = z.object({
  id: z.string(),
  shiftId: z.string(),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  status: z.string(),
  reason: z.string().nullable().optional(),
});
export type ShiftIntervalDto = z.infer<typeof shiftIntervalSchema>;

export const shiftLocationSchema = z.object({
  id: z.string(),
  shiftId: z.string(),
  userId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  source: z.string().optional(),
  capturedAt: z.string(),
});
export type ShiftLocationDto = z.infer<typeof shiftLocationSchema>;

export const agentShiftSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  punchInAt: z.string(),
  punchOutAt: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']),
  pauseReason: z.string().nullable().optional(),
  pausedAt: z.string().nullable().optional(),
  totalMinutes: z.number(),
  punchInLat: z.number().nullable().optional(),
  punchInLng: z.number().nullable().optional(),
  punchInAccuracy: z.number().nullable().optional(),
  punchInAddress: z.string().nullable().optional(),
  punchOutLat: z.number().nullable().optional(),
  punchOutLng: z.number().nullable().optional(),
  punchOutAccuracy: z.number().nullable().optional(),
  punchOutAddress: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  locations: z.array(shiftLocationSchema).optional(),
  intervals: z.array(shiftIntervalSchema).optional(),
});
export type AgentShiftDto = z.infer<typeof agentShiftSchema>;

export const timelineEventSchema = z.object({
  id: z.string(),
  type: z.enum(['PUNCH_IN', 'LOCATION_PING', 'CHECKPOINT', 'PAUSE', 'RESUME', 'PUNCH_OUT']),
  timestamp: z.string(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
  accuracy: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  durationMinutes: z.number().optional(),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const agentTimeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string(),
  avatarUrl: z.string().nullable().optional(),
  activeShift: agentShiftSchema.nullable().optional(),
  totalWorkingMinutes: z.number(),
  shiftsCount: z.number(),
  lastActiveAt: z.string().nullable().optional(),
  lastLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      capturedAt: z.string(),
      address: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type AgentTimeSummaryDto = z.infer<typeof agentTimeSummarySchema>;

export const timeLoggingQuerySchema = z.object({
  brokerId: z.string().optional(),
  agentId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  datePreset: z.enum(['today', 'yesterday', 'last_7_days', 'this_month', 'custom']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type TimeLoggingQuery = z.infer<typeof timeLoggingQuerySchema>;
