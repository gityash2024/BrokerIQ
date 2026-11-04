import { SearchRoute, searchMetadata } from '@/components/site/search-route';
import { requireOrdinarySaleListings } from '@/lib/server';
export const revalidate = 30;
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return searchMetadata('buy', await searchParams);
}
export default async function Page() {
  await requireOrdinarySaleListings();
  return <SearchRoute mode="buy" />;
}
