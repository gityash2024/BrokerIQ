import type { Metadata } from 'next';
import { shareablePropertyPhotoUrls } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { PhotoGallery } from './gallery';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const title = 'Property photos | BrokerIQ';
  const description = 'View the photos shared by your broker.';
  const gallery = /^[a-f0-9]{48}$/.test(token)
    ? await sget<{ photos: string[] }>(`/public/photo-galleries/${token}`, 0)
    : null;
  const [photo] = shareablePropertyPhotoUrls(gallery?.photos);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: photo ? [{ url: photo, alt: 'Property photo' }] : [] },
    twitter: { card: photo ? 'summary_large_image' : 'summary', title, description, images: photo ? [photo] : [] },
  };
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  return <PhotoGallery token={token} />;
}
