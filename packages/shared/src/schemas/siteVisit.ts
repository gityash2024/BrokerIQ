import { z } from 'zod';
import { SiteVisitStatus } from '../enums';

export const createSiteVisitSchema = z.object({
  leadId: z.string().uuid('Invalid lead UUID'),
  propertyId: z.string().uuid('Invalid property UUID'),
  scheduledAt: z.string().datetime('Scheduled date must be a valid ISO string'),
  assignedToId: z.string().uuid('Invalid user UUID').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateSiteVisitSchema = createSiteVisitSchema.partial().extend({
  status: z.nativeEnum(SiteVisitStatus).optional(),
  feedback: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  clientAttended: z.boolean().optional(),
  completedAt: z.string().datetime().optional().nullable(),
});

export const rescheduleSiteVisitSchema = z.object({
  scheduledAt: z.string().datetime('New scheduled time must be a valid ISO string'),
  reason: z.string().optional().nullable(),
});

export const completeSiteVisitSchema = z.object({
  feedback: z.string().min(2, 'Feedback is required to complete site visit'),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  clientAttended: z.boolean().default(true),
});

export type CreateSiteVisitDto = z.infer<typeof createSiteVisitSchema>;
export type UpdateSiteVisitDto = z.infer<typeof updateSiteVisitSchema>;
export type RescheduleSiteVisitDto = z.infer<typeof rescheduleSiteVisitSchema>;
export type CompleteSiteVisitDto = z.infer<typeof completeSiteVisitSchema>;
