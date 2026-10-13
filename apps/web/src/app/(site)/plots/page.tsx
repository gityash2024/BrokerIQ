import { redirect } from 'next/navigation';

// Broker-first pivot: Consumer marketplace is parked for now; app routes directly to /login.
// Preserved sections and imports below for future consumer marketplace rollout.
/*
import { SearchRoute, searchMetadata } from '@/components/site/search-route';
import { requireSaleListings } from '@/lib/server';

export const revalidate = 30;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return searchMetadata('plots', await searchParams);
}
*/

export default async function Page() {
  redirect('/login');
  /*
  await requireSaleListings();
  return <SearchRoute mode="plots" />;
  */
}
