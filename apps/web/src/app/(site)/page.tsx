import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import {
  AppDownloadSection,
  BannerSection,
  BlogSection,
  BrokersSection,
  CtaBannerSection,
  HeroSection,
  ListingsSection,
  LocalitiesSection,
  MapExplorerSection,
  ProjectsSection,
  TestimonialsSection,
  ToolsSection,
  WhyUsSection,
} from '@/components/home/sections';

export const revalidate = 60;

const RENDERERS: Record<string, (p: { s: any }) => React.ReactNode> = {
  HERO: HeroSection,
  LOCALITIES: LocalitiesSection,
  FEATURED_LISTINGS: ListingsSection,
  MAP_EXPLORER: MapExplorerSection,
  FEATURED_PROJECTS: ProjectsSection,
  TOP_BROKERS: BrokersSection,
  TOOLS: ToolsSection,
  WHY_US: WhyUsSection,
  TESTIMONIALS: TestimonialsSection,
  APP_DOWNLOAD: AppDownloadSection,
  BLOG: BlogSection,
  CTA_BANNER: CtaBannerSection,
  BANNER: BannerSection,
};

export default async function HomePage() {
  const sections = (await sget<any[]>('/public/homepage', 60)) ?? [];
  const hasHero = sections.some((s) => s.type === 'HERO');
  return (
    <PageShell transparentHeader={hasHero}>
      {!sections.length && (
        <HeroSection s={{ title: 'Gurgaon में अपना अगला घर ढूँढिए', subtitle: 'Verified properties, trusted brokers.', config: {}, data: null }} />
      )}
      {sections.map((s) => {
        const R = RENDERERS[s.type];
        return R ? <R key={s.id} s={s} /> : null;
      })}
    </PageShell>
  );
}
