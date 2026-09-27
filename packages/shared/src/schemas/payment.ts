import { z } from 'zod';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '../enums';

export const createOrderSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.string().default('INR'),
  planId: z.string().uuid().optional().nullable(),
  subscriptionId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  notes: z.record(z.string(), z.string()).optional(),
});

export const verifyPaymentSchema = z.object({
  providerPaymentId: z.string().min(1, 'Payment ID is required'),
  providerOrderId: z.string().min(1, 'Order ID is required'),
  providerSignature: z.string().min(1, 'Signature is required'),
});

export const manualPaymentSchema = z.object({
  organizationId: z.string().uuid('Invalid organization UUID'),
  subscriptionId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.string().default('INR'),
  paymentMethod: z.string().default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type VerifyPaymentDto = z.infer<typeof verifyPaymentSchema>;
export type ManualPaymentDto = z.infer<typeof manualPaymentSchema>;
