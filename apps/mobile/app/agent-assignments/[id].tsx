import { useLocalSearchParams } from 'expo-router';
import { canViewAgentAssignmentDashboard } from '@brokeriq/shared';
import { AgentAssignmentDetails } from '@/launch/agent-assignment-details';
import { useAgentAssignmentReport } from '@/launch/agent-assignments';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/navigation';
import { Button, ErrorView, Loader, Sheet, Txt } from '@/ui';

export default function AgentAssignmentsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = canViewAgentAssignmentDashboard(user);
  const report = useAgentAssignmentReport(allowed && !!id);
  const agent = report.data?.agents.find((entry) => entry.id === id);
  const close = () => goBack();

  if (allowed && agent && report.data) {
    return <AgentAssignmentDetails key={agent.id} agent={agent} columns={report.data.columns} onClose={close} />;
  }

  return (
    <Sheet open full inline onClose={close} title="Agent assignments" footer={<Button title="Close" variant="secondary" onPress={close} />}>
      {allowed && id && report.isPending ? (
        <Loader />
      ) : allowed && report.error ? (
        <ErrorView error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <Txt color="muted">This agent’s assignments are unavailable.</Txt>
      )}
    </Sheet>
  );
}
