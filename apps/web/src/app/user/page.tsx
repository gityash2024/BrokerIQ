'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BedDouble, Building2, MapPin, Search, Store, Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { PageShell } from '@/components/site/page-shell';
import { ListingCard, ListingCardSkeleton } from '@/components/site/listing-card';
import { ApiErrorState } from '@/components/ui/api-error';
import { Empty } from '@/components/ui/misc';
import type { ListingCard as LC, Paged } from '@/lib/types';
export default function ConsumerHome() {
  const listings = useQuery({ queryKey: ['consumer-home-listings'], queryFn: () => api<Paged<LC>>('/listings?purpose=RENT&pageSize=6', { auth: false }) });
  const locs = useQuery({
    queryKey: ['consumer-home-localities'],
    queryFn: () => api<{ name: string; slug: string }[]>('/public/localities?popular=true', { auth: false }),
  });
  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block">
          <img src="/product/brokeriq-city.webp" alt="Conceptual architectural illustration" className="h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/10 to-transparent" />
        </div>
        <div className="container-x relative py-12 sm:py-20">
          <p className="section-kicker">YOUR NEXT CHAPTER, IN GURUGRAM</p>
          <h1 className="mt-5 max-w-xl font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
            Find a space.
            <br />
            <span className="text-brand-600">Make it yours.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-muted">
            Homes, PG and workspaces for rent. Explore localities, save your favourites and connect with the person behind the listing.
          </p>
          <form
            action="/user/search"
            className="mt-7 flex max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface p-2 shadow-lg shadow-brand-900/5"
          >
            <Search className="ml-3 size-5 shrink-0 text-brand-600" />
            <label className="sr-only" htmlFor="home-query">
              Search locality or property
            </label>
            <input
              id="home-query"
              name="q"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Sector, society or property…"
            />
            <button className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white">Search</button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              [Building2, 'Homes', '/user/search'],
              [BedDouble, 'PG & co-living', '/user/search?types=PG'],
              [Store, 'Commercial', '/user/commercial'],
            ].map(([Icon, label, href]) => {
              const I = Icon as typeof Building2;
              return (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/90 px-4 text-xs font-semibold"
                >
                  <I className="size-4 text-brand-600" />
                  {String(label)}
                  <ArrowUpRight className="size-3 text-muted" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <div className="container-x py-10 sm:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">EXPLORE THE NEIGHBOURHOOD</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">A locality that feels like you.</h2>
          </div>
          <Link href="/user/localities" className="shrink-0 text-xs font-semibold text-brand-600">
            Explore all ↗
          </Link>
        </div>
        {locs.isError ? (
          <ApiErrorState error={locs.error} onRetry={() => locs.refetch()} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {locs.data?.slice(0, 12).map((l) => (
              <Link
                key={l.slug}
                href={`/user/search?localities=${encodeURIComponent(l.slug)}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-medium"
              >
                <MapPin className="size-3.5 text-brand-600" />
                {l.name}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-12 mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">YOUR SEARCH STARTS HERE</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Discover rental listings.</h2>
          </div>
          <Link href="/user/search" className="text-xs font-semibold text-brand-600">
            View all ↗
          </Link>
        </div>
        {listings.isError ? (
          <ApiErrorState error={listings.error} onRetry={() => listings.refetch()} />
        ) : listings.isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.data?.items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.data.items.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Heart className="size-6" />}
            title="New possibilities are on their way"
            text="There are no published rentals right now. Tell us what you need or save a search to check again."
            action={
              <Link className="font-semibold text-brand-600" href="/user/account/requirements">
                Tell us your requirement →
              </Link>
            }
          />
        )}
        <section className="workspace-hero mt-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="section-kicker">HAVE A PROPERTY TO RENT?</p>
            <h2 className="mt-2 font-display text-2xl font-bold">Help someone find their next place.</h2>
            <p className="mt-2 text-sm text-muted">Create a listing. We review it before it goes live.</p>
          </div>
          <Link
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white"
            href="/user/post-property"
          >
            Post a property <ArrowUpRight className="size-4" />
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
