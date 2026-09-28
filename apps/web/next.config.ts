import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@brokeriq/shared'],
  // Images are served from Cloudinary / S3 CDNs with on-the-fly transforms, so Next's
  // optimizer is disabled to keep hosting free (no Vercel image-optimization quota).
  images: { unoptimized: true },
  poweredByHeader: false,
  // Rental marketplace: sale-only sections (buy, plots, new-launch projects) point to rentals.
  // Temporary redirects so the old pages can come back without cache issues.
  async redirects() {
    return [
      { source: '/buy', destination: '/rent', permanent: false },
      { source: '/plots', destination: '/rent', permanent: false },
      { source: '/projects', destination: '/rent', permanent: false },
      { source: '/projects/:slug', destination: '/rent', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
