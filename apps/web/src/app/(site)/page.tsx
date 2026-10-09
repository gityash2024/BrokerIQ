import { redirect } from 'next/navigation';
// Broker-first pivot: Consumer marketplace is parked for now; app routes directly to Broker OS.
// Preserved sections and imports below for future consumer marketplace rollout.
/*
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
*/

export default function HomePage() {
  redirect('/broker/login');
}
