import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getConfig } from '@/lib/server';
import { SITE_URL } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap', weight: ['500', '600', '700', '800'] });
const deva = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-deva', display: 'swap', weight: ['400', '500', '600', '700'] });

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} ${deva.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers config={config}>{children}</Providers>
      </body>
    </html>
  );
}
