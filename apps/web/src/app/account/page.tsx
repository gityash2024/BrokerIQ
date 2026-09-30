'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building, Clock, Heart, Search, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/panel/shell';
import { ListingCard } from '@/components/site/listing-card';
import { Button } from '@/components/ui/button';
import { Stat } from '@/components/ui/misc';

export default function AccountHome() {
  const { user } = useAuth();
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => api<any[]>('/listings/saved') });
  const recent = useQuery({ queryKey: ['recent'], queryFn: () => api<any[]>('/listings/recent') });
  const searches = useQuery({ queryKey: ['saved-searches'], queryFn: () => api<any[]>('/me/saved-searches') });
  const enq = useQuery({ queryKey: ['enquiries-sent'], queryFn: () => api<any[]>('/enquiries/sent') });
  const mine = useQuery({ queryKey: ['my-listings'], queryFn: () => api<any>('/listings/mine?pageSize=4') });
  return (
    <div className="space-y-8">
      <PageHeader title={`नमस्ते, ${user?.name.split(' ')[0]} 👋`} subtitle="आपकी property journey एक नज़र में" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/account/saved">
          <Stat label="Saved properties" value={saved.data?.length ?? '—'} icon={<Heart className="size-5" />} tone="danger" />
        </Link>
        <Link href="/account/searches">
          <Stat label="Search alerts" value={searches.data?.length ?? '—'} icon={<Search className="size-5" />} />
        </Link>
        <Link href="/account/enquiries">
          <Stat label="Enquiries sent" value={enq.data?.length ?? '—'} icon={<Send className="size-5" />} tone="info" />
        </Link>
        <Link href="/account/listings">
          <Stat label="My listings" value={mine.data?.total ?? '—'} icon={<Building className="size-5" />} tone="success" />
        </Link>
      </div>
      {recent.data && recent.data.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Clock className="size-5 text-brand-600" /> Recently viewed
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {recent.data.slice(0, 4).map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        </section>
      )}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-display text-lg font-bold">Property खोज रहे हैं?</h3>
          <p className="mt-1 text-sm text-muted">अपनी requirement के हिसाब से search save करें — नई property आते ही alert मिलेगा।</p>
          <Button href="/rent" className="mt-4">
            Search properties <ArrowRight className="size-4" />
          </Button>
        </div>
        <div className="card bg-gradient-to-br from-saffron-50 to-transparent p-6 dark:from-saffron-500/10">
          <h3 className="font-display text-lg font-bold">Property बेचनी या किराये पर देनी है?</h3>
          <p className="mt-1 text-sm text-muted">Free में post करें और सीधे buyers/tenants से enquiries पाएँ।</p>
          <Button href="/post-property" variant="accent" className="mt-4">
            Post property FREE
          </Button>
        </div>
      </section>
    </div>
  );
}
