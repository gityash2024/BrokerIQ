import { getRelease } from '@/lib/release';
export const dynamic = 'force-dynamic';
export async function GET() {
  const release = await getRelease();
  return Response.json(release ?? { status: 'unreleased-development' }, { headers: { 'Cache-Control': 'no-store' } });
}
