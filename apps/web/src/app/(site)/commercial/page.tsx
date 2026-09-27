import { SearchRoute, searchMetadata } from '@/components/site/search-route';

export const revalidate = 30;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return searchMetadata('commercial', await searchParams);
}

export default function Page() {
  return <SearchRoute mode="commercial" />;
}
