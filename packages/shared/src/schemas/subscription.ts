import { z } from 'zod';
import { BillingPeriod, PlanTier, SubscriptionStatus } from '../enums';

export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('Invalid plan UUID'),
  billingPeriod: z.nativeEnum(BillingPeriod).default(BillingPeriod.MONTHLY),
  couponCode: z.string().optional().nullable(),
});

export const changePlanSchema = z.object({
  planId: z.string().uuid('Invalid plan UUID'),
  billingPeriod: z.nativeEnum(BillingPeriod).optional(),
});

export const pauseSubscriptionSchema = z.object({
  reason: z.string().optional().nullable(),
});

export const createPlanSchema = z.object({
  name: z.string().min(2, 'Plan name is required'),
  code: z.nativeEnum(PlanTier),
  description: z.string().optional().nullable(),
  priceMonthly: z.number().nonnegative('Monthly price cannot be negative'),
  priceYearly: z.number().nonnegative('Yearly price cannot be negative'),
  currency: z.string().default('INR'),
  trialDays: z.number().int().min(0).default(14),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updatePlanSchema = createPlanSchema.partial();

export type CreateSubscriptionDto = z.infer<typeof createSubscriptionSchema>;
export type ChangePlanDto = z.infer<typeof changePlanSchema>;
export type PauseSubscriptionDto = z.infer<typeof pauseSubscriptionSchema>;
export type CreatePlanDto = z.infer<typeof createPlanSchema>;
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;
