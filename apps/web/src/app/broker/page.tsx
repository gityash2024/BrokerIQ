import { EnterpriseDashboard } from '@/components/dashboard/dashboard';
import { TodayActions } from '@/components/dashboard/today-actions';
export default function BrokerOverview() {
  return (
    <EnterpriseDashboard role="broker">
      <TodayActions />
    </EnterpriseDashboard>
  );
}
