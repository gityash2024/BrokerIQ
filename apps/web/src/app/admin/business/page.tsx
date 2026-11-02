import { AdminBusinessWorkspace } from '@/components/admin/business-workspace';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const initial = Object.fromEntries(Object.entries(query).filter((pair): pair is [string, string] => typeof pair[1] === 'string'));
  return <AdminBusinessWorkspace initial={initial} />;
}
