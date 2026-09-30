import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BadgeCheck, Globe, Mail, MapPin, MessageCircle, Phone, Star, UserPlus } from 'lucide-react';
import { whatsappLink } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { API_URL } from '@/lib/utils';
import { ListingCard } from '@/components/site/listing-card';
import { Avatar, Badge, Logo } from '@/components/ui/misc';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ a?: string }> };

const load = async (slug: string, a?: string) => sget<any>(`/public/card/${encodeURIComponent(slug)}${a ? `?a=${encodeURIComponent(a)}` : ''}`, 300);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { a }] = await Promise.all([params, searchParams]);
  const c = await load(slug, a);
  if (!c) return { title: 'Card not found', robots: { index: false } };
  const who = c.agent ? `${c.agent.name} · ${c.org.name}` : c.org.name;
  return {
    title: `${who} — visiting card`,
    description: `${who}: Gurgaon rental properties. Call, WhatsApp or save the contact.`,
    openGraph: { images: c.agent?.avatarUrl ? [c.agent.avatarUrl] : c.org.logoUrl ? [c.org.logoUrl] : undefined },
  };
}

/** Public digital visiting card of a broker firm or one of its agents. */
export default async function CardPage({ params, searchParams }: Props) {
  const [{ slug }, { a }] = await Promise.all([params, searchParams]);
  const c = await load(slug, a);
  if (!c) notFound();
  const { org, agent } = c;
  const phone: string | null = agent?.phone ?? org.whatsapp ?? org.phone;
  const wa: string | null = org.whatsapp ?? agent?.phone ?? org.phone;
  const qs = agent ? `?a=${encodeURIComponent(agent.id)}` : '';
  return (
    <main className="min-h-screen bg-surface-2 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="card overflow-hidden">
          <div className="mesh-hero h-24" />
          <div className="-mt-12 px-6 pb-6 text-center">
            <Avatar name={agent?.name ?? org.name} src={agent?.avatarUrl ?? org.logoUrl} size={96} className="mx-auto ring-4 ring-surface" />
            <h1 className="mt-3 flex items-center justify-center gap-1.5 font-display text-2xl font-extrabold" data-no-i18n>
              {agent?.name ?? org.name}
              {org.verification === 'VERIFIED' && <BadgeCheck className="size-6 text-emerald-500" />}
            </h1>
            {agent && (
              <p className="text-sm text-muted">
                {agent.title} · <span data-no-i18n>{org.name}</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
              {org.reviewCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" /> {org.rating.toFixed(1)} ({org.reviewCount})
                </span>
              )}
              {org.experienceYears && <span>{org.experienceYears}+ years</span>}
              {org.reraNumber && <Badge tone="success">RERA {org.reraNumber}</Badge>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white">
                  <Phone className="size-4" /> Call
                </a>
              )}
              {wa && (
                <a
                  href={whatsappLink(wa, 'नमस्ते, आपका visiting card देखा — मुझे property चाहिए।')}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
              <a
                href={`${API_URL}/api/public/card/${org.slug}/vcf${qs}`}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-bold"
              >
                <UserPlus className="size-4" /> Contact save करें
              </a>
            </div>
            <ul className="mt-5 space-y-2 text-left text-sm">
              {(agent?.email ?? org.email) && (
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-muted" /> <span data-no-i18n>{agent?.email ?? org.email}</span>
                </li>
              )}
              {org.address && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted" /> <span data-no-i18n>{org.address}</span>
                </li>
              )}
              {org.website && (
                <li className="flex items-center gap-2">
                  <Globe className="size-4 text-muted" />
                  <a href={org.website} target="_blank" rel="noopener nofollow" className="text-brand-600" data-no-i18n>
                    {org.website.replace(/^https?:\/\//, '')}
                  </a>
                </li>
              )}
            </ul>
            {org.localities?.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {org.localities.map((l: any) => (
                  <span key={l.slug} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                    {l.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {c.listings.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Properties</h2>
              <Link href={`/brokers/${org.slug}`} className="text-sm font-semibold text-brand-600">
                सभी {c.liveCount} देखें →
              </Link>
            </div>
            <div className="grid gap-4">
              {c.listings.map((l: any) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          </div>
        )}
        <Link href="/" className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
          Made with <Logo className="h-4" />
        </Link>
      </div>
    </main>
  );
}
