import { z } from 'zod';

export const ADMIN_BUSINESS_RESOURCES = {
  leads: 'Leads',
  requirements: 'Requirements',
  imports: 'Imports',
  sources: 'Source entries',
  inventory: 'Inventory',
  listings: 'Published listings',
  conversations: 'Conversations',
  messages: 'Messages',
  kyc: 'KYC submissions',
  shifts: 'Shifts',
  followups: 'Follow-ups',
  visits: 'Site visits',
  invoices: 'Invoices',
  automations: 'Automation rules',
  runs: 'Automation runs',
  webhooks: 'Webhook events',
  jobs: 'Background jobs',
  ai: 'AI usage',
} as const;
export const adminBusinessResourceSchema = z.enum(
  Object.keys(ADMIN_BUSINESS_RESOURCES) as [keyof typeof ADMIN_BUSINESS_RESOURCES, ...(keyof typeof ADMIN_BUSINESS_RESOURCES)[]],
);
export type AdminBusinessResource = z.infer<typeof adminBusinessResourceSchema>;
export const adminBusinessQuerySchema = z
  .object({
    organizationId: z.string().min(1).max(100).optional(),
    memberId: z.string().min(1).max(100).optional(),
    q: z.string().trim().max(200).optional(),
    status: z.string().max(60).optional(),
    archive: z.enum(['all', 'active', 'archived']).default('all'),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), { path: ['to'], message: 'End must be on or after start' });
export type AdminBusinessQuery = z.infer<typeof adminBusinessQuerySchema>;
export interface AdminBusinessRow {
  id: string;
  organizationId: string | null;
  firm: string | null;
  memberId: string | null;
  member: string | null;
  title: string;
  status: string | null;
  createdAt: string;
}
export interface AdminBusinessPage {
  items: AdminBusinessRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statuses: string[];
  supportsMember: boolean;
  supportsArchive: boolean;
}
