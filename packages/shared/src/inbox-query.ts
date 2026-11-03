import { z } from 'zod';

export const inboxListQuerySchema = z.object({
  channel: z.enum(['WHATSAPP', 'CHAT', 'SMS', 'EMAIL']).default('WHATSAPP'),
  q: z.string().trim().max(200).optional(),
  unread: z.enum(['true', 'false']).optional(),
  paginated: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type InboxListQuery = z.infer<typeof inboxListQuerySchema>;
export interface InboxPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
