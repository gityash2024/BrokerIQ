'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/panel/shell';
import { ListingForm } from '@/components/site/listing-form';

export default function NewBrokerListing() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="नई listing" subtitle="Photos, सही price और locality से listing जल्दी approve होती है" />
      <ListingForm
        role="broker"
        afterSave={(l) => {
          toast.success(l.status === 'ACTIVE' ? 'Listing live है 🎉' : l.status === 'DRAFT' ? 'Draft saved' : 'Review के लिए भेज दी गई');
          router.push('/broker/listings');
        }}
      />
    </>
  );
}
