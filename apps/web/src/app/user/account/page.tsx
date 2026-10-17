import { EnterpriseDashboard } from '@/components/dashboard/dashboard';
import { RecentlyViewed } from '@/components/dashboard/recent';
export default function CustomerOverview() {
  return (
    <EnterpriseDashboard role="user">
      <RecentlyViewed />
    </EnterpriseDashboard>
  );
}
