import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { Logo } from '../ui/misc';
import { sget } from '@/lib/server';

export async function SiteFooter() {
  const [cfg, locs] = await Promise.all([sget<any>('/public/config', 300), sget<any[]>('/public/localities?popular=true', 600)]);
  const app = cfg?.app;
  const year = new Date().getFullYear();
  const social = app?.social ?? {};
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo name={app?.siteName} />
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{app?.tagline}. Gurgaon के हर sector की verified properties, भरोसेमंद brokers और smart tools — एक जगह।</p>
          <div className="mt-5 space-y-2 text-sm text-muted">
            {app?.supportPhone && (
              <a href={`tel:${app.supportPhone}`} className="flex items-center gap-2 hover:text-fg">
                <Phone className="size-4" /> {app.supportPhone}
              </a>
            )}
            {app?.supportEmail && (
              <a href={`mailto:${app.supportEmail}`} className="flex items-center gap-2 hover:text-fg">
                <Mail className="size-4" /> {app.supportEmail}
              </a>
            )}
            {app?.officeAddress && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" /> {app.officeAddress}
              </p>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            {[
              [social.facebook, Facebook],
              [social.instagram, Instagram],
              [social.linkedin, Linkedin],
              [social.youtube, Youtube],
            ]
              .filter(([u]) => u)
              .map(([u, Icon]: any) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-xl border border-line text-muted transition hover:border-brand-400 hover:text-brand-600">
                  <Icon className="size-4" />
                </a>
              ))}
          </div>
        </div>
        <FooterCol
          title="Explore"
          links={[
            ['/rent', 'Homes for rent'],
            ['/rent?furnishing=FULLY_FURNISHED', 'Furnished flats'],
            ['/rent?types=PG', 'PG & co-living'],
            ['/commercial', 'Commercial for rent'],
            ['/brokers', 'Find a broker'],
          ]}
        />
        <FooterCol
          title="Popular localities"
          links={(locs ?? []).slice(0, 7).map((l: any) => [`/locality/${l.slug}`, l.name] as [string, string])}
        />
        <FooterCol
          title="BrokerIQ"
          links={[
            ['/for-brokers', 'For brokers'],
            ['/post-property', 'Post property'],
            ['/tools', 'Property tools'],
            ['/blog', 'Guides & news'],
            ['/help', 'Help & FAQs'],
            ['/contact', 'Contact us'],
            ['/p/about', 'About'],
            ['/p/terms', 'Terms'],
            ['/p/privacy', 'Privacy'],
            ['/account-deletion', 'Account deletion'],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-subtle sm:flex-row">
          <p>© {year} {app?.siteName ?? 'BrokerIQ'}. Made with ❤️ in Gurgaon.</p>
          <p>Prices and details are provided by listers. Verify before transacting.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="font-display text-sm font-bold tracking-wide uppercase">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-muted transition hover:text-brand-600">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
