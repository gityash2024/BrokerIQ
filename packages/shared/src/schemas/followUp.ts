import { z } from 'zod';
import { FollowUpStatus, FollowUpType } from '../enums';

export const createFollowUpSchema = z.object({
  leadId: z.string().uuid('Invalid lead UUID'),
  customerId: z.string().uuid('Invalid customer UUID').optional().nullable(),
  scheduledAt: z.string().datetime('Scheduled date must be a valid ISO string'),
  reminderAt: z.string().datetime('Reminder date must be a valid ISO string').optional().nullable(),
  type: z.nativeEnum(FollowUpType).default(FollowUpType.CALL),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid('Invalid user UUID').optional().nullable(),
});

export const updateFollowUpSchema = createFollowUpSchema.partial().extend({
  status: z.nativeEnum(FollowUpStatus).optional(),
  outcomeNotes: z.string().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
});

export const rescheduleFollowUpSchema = z.object({
  scheduledAt: z.string().datetime('New scheduled time must be a valid ISO string'),
  reason: z.string().optional().nullable(),
});

export const completeFollowUpSchema = z.object({
  outcomeNotes: z.string().min(2, 'Outcome notes are required to complete a follow-up'),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
});

export type CreateFollowUpDto = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpDto = z.infer<typeof updateFollowUpSchema>;
export type RescheduleFollowUpDto = z.infer<typeof rescheduleFollowUpSchema>;
export type CompleteFollowUpDto = z.infer<typeof completeFollowUpSchema>;
