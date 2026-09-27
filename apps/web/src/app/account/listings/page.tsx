'use client';
import { PageHeader } from '@/components/panel/shell';
import { MyListings } from '@/components/site/my-listings';

export default function AccountListings() {
  return (
    <>
      <PageHeader title="My listings" subtitle="आपकी posted properties, views और enquiries" />
      <MyListings base="/account/listings" newHref="/account/listings/new" />
    </>
  );
}
