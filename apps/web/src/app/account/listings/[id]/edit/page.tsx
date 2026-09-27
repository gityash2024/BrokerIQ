'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { ListingForm, listingToForm } from '@/components/site/listing-form';
import { ApiErrorState } from '@/components/ui/api-error';
import { PageLoader } from '@/components/ui/misc';

export default function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const q = useQuery({ queryKey: ['listing-edit', id], queryFn: () => api<any>(`/listings/${id}?track=0`) });
  if (q.isLoading) return <PageLoader />;
  if (q.error) return <ApiErrorState error={q.error} />;
  return (
    <>
      <PageHeader title="Edit listing" subtitle={q.data.title} />
      <ListingForm
        listingId={id}
        initial={listingToForm(q.data)}
        afterSave={() => {
          toast.success('Saved');
          router.push('/account/listings');
        }}
      />
    </>
  );
}
