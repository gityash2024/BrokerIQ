import type { Metadata, Viewport } from 'next';
import './property-fonts.css';
import './globals.css';
import { I18N_BOOT_SCRIPT } from '@/lib/i18n-boot';
import { Providers } from './providers';
import { getConfig } from '@/lib/server';
import { SITE_URL } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getConfig();
  const app = cfg?.app;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: app?.seo.defaultTitle ?? 'BrokerIQ — Gurgaon Property', template: `%s | ${app?.siteName ?? 'BrokerIQ'}` },
    description: app?.seo.defaultDescription,
    applicationName: app?.siteName ?? 'BrokerIQ',
    openGraph: { type: 'website', siteName: app?.siteName ?? 'BrokerIQ', images: app?.seo.ogImage ? [app.seo.ogImage] : undefined, locale: 'en_IN' },
    twitter: { card: 'summary_large_image' },
    icons: { icon: '/icon.svg' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#080b16' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem('biq.theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getConfig();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: I18N_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers config={config}>{children}</Providers>
      </body>
    </html>
  );
}
