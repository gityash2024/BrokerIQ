import { ModuleAccess } from '@/components/panel/module-access';
import { SiteFooter } from '@/components/site/footer';
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleAccess>
      {children}
      <SiteFooter />
    </ModuleAccess>
  );
}
