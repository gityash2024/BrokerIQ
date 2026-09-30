'use client';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { ListingCard, ListingCardSkeleton } from '@/components/site/listing-card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/misc';

export default function SavedPage() {
  const q = useQuery({ queryKey: ['saved'], queryFn: () => api<any[]>('/listings/saved') });
  return (
    <>
      <PageHeader title="Saved properties" subtitle="आपकी shortlist" />
      {q.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : !q.data?.length ? (
        <Empty
          icon={<Heart className="size-6" />}
          title="अभी कुछ saved नहीं"
          text="Property card पर ❤️ दबाकर shortlist बनाएँ।"
          action={<Button href="/rent">Properties देखें</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((l) => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>
      )}
    </>
  );
}
