import { z } from 'zod';

const teamRole = z.enum(['BROKER_ADMIN', 'BROKER_AGENT']);
export const brokerTeamResponseSchema = z.object({
  members: z.array(z.object({
    id: z.string(), name: z.string(), email: z.string().nullable(), phone: z.string().nullable(),
    avatarUrl: z.string().nullable(), role: teamRole, status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
    lastLoginAt: z.string().nullable(), createdAt: z.string(),
    kycStatus: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']).optional().default('UNVERIFIED'),
    kycDocuments: z.array(z.any()).optional().default([]),
    stats: z.object({ openLeads: z.number().int().nonnegative(), won30d: z.number().int().nonnegative(), activities30d: z.number().int().nonnegative() }),
  })),
  invites: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), role: teamRole, expiresAt: z.string() })),
});
export type BrokerTeamResponse = z.infer<typeof brokerTeamResponseSchema>;
