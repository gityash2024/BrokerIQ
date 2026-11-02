import { notFound } from 'next/navigation';
import { adminBusinessResourceSchema } from '@brokeriq/shared';
import { AdminBusinessDetail } from '@/components/admin/business-workspace';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resource, id } = await params;
  const parsed = adminBusinessResourceSchema.safeParse(resource);
  if (!parsed.success) notFound();
  const query = await searchParams;
  const back = new URLSearchParams();
  for (const key of ['resource', 'organizationId', 'memberId', 'q', 'fromDate', 'toDate', 'status', 'archive', 'sort', 'page'])
    if (typeof query[key] === 'string') back.set(key, query[key]);
  return <AdminBusinessDetail resource={parsed.data} id={id} back={back.size ? '?' + back.toString() : ''} />;
}
