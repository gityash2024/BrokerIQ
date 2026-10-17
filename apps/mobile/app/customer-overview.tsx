import { NativeDashboard } from '@/launch/dashboard';
import { Screen, Header } from '@/ui';
export default function CustomerOverview() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="My overview" />
      <NativeDashboard role="user" />
    </Screen>
  );
}
