import type { Prisma, Channel } from '@prisma/client';
import type { RequestUser } from '../../common/decorators';

/** Same business visibility for inbox lists and unread counters across all four channels. */
export function inboxChannelWhere(orgId: string, user: RequestUser, channel: Channel): Prisma.ConversationWhereInput {
  return {
    organizationId: orgId,
    channel,
    ...(channel === 'WHATSAPP'
      ? {
          lead: { is: { organizationId: orgId, source: 'HOUSING', deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) } },
        }
      : user.role === 'BROKER_AGENT'
        ? { lead: { is: { organizationId: orgId, assignedToId: user.id, deletedAt: null } } }
        : {}),
  };
}
export function liveTaskLeadWhere(orgId: string, user: RequestUser): Prisma.LeadWhereInput {
  return { organizationId: orgId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) };
}
