import { EnterpriseDashboard } from '@/components/dashboard/dashboard';
import { AgentAssignments } from '@/components/dashboard/agent-assignments';
import { TodayActions } from '@/components/dashboard/today-actions';
export default function BrokerOverview() {
  return (
    <EnterpriseDashboard role="broker" overview={<AgentAssignments />}>
      <TodayActions />
    </EnterpriseDashboard>
  );
}
