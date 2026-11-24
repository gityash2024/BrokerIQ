import { z } from 'zod';

const id = z.string().min(1).max(100);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const connectSettings = z.object({
  consent: z.boolean().default(false),
  calls: z.boolean().default(false),
  recordings: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
  analysis: z.boolean().default(false),
  createLeads: z.boolean().default(false),
  createInventory: z.boolean().default(false),
  fillSurvey: z.boolean().default(false),
  backgroundSync: z.boolean().default(false),
  groups: z.array(hash).max(100).default([]),
});
export const connectFirmPolicy = z.object({
  leads: z.boolean().default(false),
  inventory: z.boolean().default(false),
  survey: z.boolean().default(false),
  retentionDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365), z.null()]).optional(),
}).strict();
export type ConnectFirmPolicy = z.infer<typeof connectFirmPolicy>;
export const connectRegistration = z.object({ installId: z.uuid(), label: z.string().trim().min(1).max(100), version: z.number().int().positive() });
const event = { capturedAt: z.iso.datetime({ offset: true }) };
export const connectCapture = z.discriminatedUnion('kind', [
  z.object({ ...event, kind: z.literal('WHATSAPP'), packageName: z.enum(['com.whatsapp.w4b', 'com.whatsapp']),
    group: hash, text: z.string().trim().min(2).max(4000), senderPhone: z.string().max(24).optional() }),
  z.object({ ...event, kind: z.literal('CALL'), direction: z.enum(['INBOUND', 'OUTBOUND']), leadId: id,
    number: z.string().trim().min(8).max(25), durationSec: z.number().int().min(0).max(86400).optional(),
    outcome: z.enum(['DETECTED', 'COMPLETED', 'MISSED', 'REJECTED']).default('DETECTED') }),
]);
export const connectRecording = z.object({
  ...event,
  callId: id,
  mime: z.enum(['audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-wav']),
  base64: z.string().max(16 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type ConnectSettings = z.infer<typeof connectSettings>;
export type ConnectRegistration = z.infer<typeof connectRegistration>;
export type ConnectCapture = z.infer<typeof connectCapture>;
export type ConnectRecording = z.infer<typeof connectRecording>;
