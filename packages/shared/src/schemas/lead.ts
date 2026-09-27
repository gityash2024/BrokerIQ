import { z } from 'zod';
import { LeadPriority, LeadSource, LeadStage, PropertyType } from '../enums';
import { REGEX_PATTERNS } from '../constants';

export const createLeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number'),
  email: z.string().email('Invalid email address').optional().nullable(),
  source: z.nativeEnum(LeadSource).default(LeadSource.MANUAL),
  stage: z.nativeEnum(LeadStage).optional().default(LeadStage.NEW),
  budgetMin: z.number().positive('Budget min must be positive').optional().nullable(),
  budgetMax: z.number().positive('Budget max must be positive').optional().nullable(),
  preferredBhk: z.string().optional().nullable(),
  preferredLocation: z.string().optional().nullable(),
  propertyType: z.nativeEnum(PropertyType).optional().nullable(),
  priority: z.nativeEnum(LeadPriority).optional().default(LeadPriority.MEDIUM),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid('Invalid user UUID').optional().nullable(),
  customerId: z.string().uuid('Invalid customer UUID').optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  lostReason: z.string().optional().nullable(),
  lostReasonNotes: z.string().optional().nullable(),
  score: z.number().int().min(0).max(100).optional(),
  lastContactedAt: z.string().datetime().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
});

export const leadStageTransitionSchema = z.object({
  stage: z.nativeEnum(LeadStage),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const leadFilterSchema = z.object({
  stage: z.nativeEnum(LeadStage).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
  assignedToId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;
export type LeadStageTransitionDto = z.infer<typeof leadStageTransitionSchema>;
export type LeadFilterDto = z.infer<typeof leadFilterSchema>;
