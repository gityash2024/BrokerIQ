'use client';

import { PageHeader } from '@/components/panel/shell';
import { MyListings } from '@/components/site/my-listings';
import { InventoryTabs } from '@/components/broker/launch/inventory-tabs';

export default function BrokerListings() {
  return (
    <>
      <PageHeader title="Publish Listing" subtitle="Properties live on the BrokerIQ marketplace." />
      <InventoryTabs active="/broker/listings" />
      <MyListings base="/broker/listings" newHref="/broker/listings/new" activeOnly />
    </>
  );
}
