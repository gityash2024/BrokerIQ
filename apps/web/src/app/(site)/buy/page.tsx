import { SearchRoute, searchMetadata } from '@/components/site/search-route';
import { requireSaleListings } from '@/lib/server';

export const revalidate = 30;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return searchMetadata('buy', await searchParams);
}

export default async function Page() {
  await requireSaleListings();
  return <SearchRoute mode="buy" />;
}
