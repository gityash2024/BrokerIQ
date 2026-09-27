import { notFound, redirect } from 'next/navigation';
import { API_URL } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Tracked share links: count the open, then redirect to the property. */
export default async function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = await fetch(`${process.env.API_INTERNAL_URL || API_URL}/api/public/share/${code}`, { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) notFound();
  const { slug } = await res.json();
  redirect(`/property/${slug}`);
}
