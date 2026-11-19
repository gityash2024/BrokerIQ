import type { Prisma } from '@prisma/client';

export const assignmentDashboardSettingKey = (memberId: string) => `assignment_dashboard_agents:${memberId}`;

export function activeFirmAgents(organizationId: string): Prisma.UserWhereInput {
  return { organizationId, role: 'BROKER_AGENT', status: 'ACTIVE', deletedAt: null };
}

export async function assignedDashboardAgentIds(db: Prisma.TransactionClient, organizationId: string, memberId: string): Promise<string[]> {
  const setting = await db.orgSetting.findUnique({
    where: { organizationId_key: { organizationId, key: assignmentDashboardSettingKey(memberId) } },
    select: { value: true },
  });
  return Array.isArray(setting?.value) ? setting.value.filter((id): id is string => typeof id === 'string') : [];
}
