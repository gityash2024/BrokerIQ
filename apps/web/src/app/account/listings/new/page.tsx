'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/panel/shell';
import { ListingForm } from '@/components/site/listing-form';

export default function NewListing() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Post property" />
      <ListingForm
        afterSave={(l) => {
          toast.success(l.status === 'ACTIVE' ? 'Listing live है 🎉' : l.status === 'DRAFT' ? 'Draft saved' : 'Review के लिए भेज दी गई');
          router.push('/account/listings');
        }}
      />
    </>
  );
}
