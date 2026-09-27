import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrokerIQ — Gurgaon Property',
    short_name: 'BrokerIQ',
    start_url: '/',
    display: 'standalone',
    background_color: '#080b16',
    theme_color: '#4f46e5',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
