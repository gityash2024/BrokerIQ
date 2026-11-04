import type { Prisma } from '@prisma/client';

export async function hasAnotherActiveBrokerAdmin(tx: Prisma.TransactionClient, organizationId: string, userId: string) {
  return !!(await tx.user.findFirst({
    where: { id: { not: userId }, organizationId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  }));
}

/** Release work for reassignment while preserving its firm and historical actor. */
export async function releaseFirmAssignments(tx: Prisma.TransactionClient, organizationId: string, userId: string) {
  const owned = { organizationId, assignedToId: userId };
  const pendingTask = { assignedToId: null, reminderSentAt: null };
  await tx.lead.updateMany({ where: owned, data: { assignedToId: null } });
  await tx.followUp.updateMany({ where: { ...owned, status: 'PENDING' }, data: pendingTask });
  await tx.siteVisit.updateMany({ where: { ...owned, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, data: pendingTask });
  await tx.inventoryItem.updateMany({ where: owned, data: { assignedToId: null } });
  await tx.brokerRequirement.updateMany({ where: owned, data: { assignedToId: null } });
}
