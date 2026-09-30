'use client';
import { ScanLine } from 'lucide-react';
import { PageHeader } from '@/components/panel/shell';
import { MyListings } from '@/components/site/my-listings';
import { Button } from '@/components/ui/button';

export default function BrokerListings() {
  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Firm की सारी listings — marketplace पर live, views, enquiries और boost"
        actions={
          <Button size="sm" variant="secondary" href="/broker/scanner">
            <ScanLine className="size-4" /> Book scan से import
          </Button>
        }
      />
      <MyListings base="/broker/listings" newHref="/broker/listings/new" />
    </>
  );
}
