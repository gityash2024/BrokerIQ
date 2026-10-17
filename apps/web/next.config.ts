import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@brokeriq/shared', '@brokeriq/landing'],
  // Images are served from Cloudinary / S3 CDNs with on-the-fly transforms, so Next's
  // optimizer is disabled to keep hosting free (no Vercel image-optimization quota).
  images: { unoptimized: true },
  poweredByHeader: false,
  // Canonical consumer URLs. Next preserves query filters on redirects.
  async redirects() {
    return [
      { source: '/admin/settings', destination: '/admin/settings/integrations', permanent: false },
      { source: '/broker/login', destination: '/login', permanent: false },
      { source: '/rent', destination: '/user/search', permanent: false },
      { source: '/commercial', destination: '/user/commercial', permanent: false },
      { source: '/account/:path*', destination: '/user/account/:path*', permanent: false },
      { source: '/search', destination: '/user/search', permanent: false },
      { source: '/property/:path*', destination: '/user/property/:path*', permanent: false },
      { source: '/locality/:path*', destination: '/user/locality/:path*', permanent: false },
      { source: '/localities', destination: '/user/localities', permanent: false },
      { source: '/post-property', destination: '/user/post-property', permanent: false },
      { source: '/brokers/:path*', destination: '/user/brokers/:path*', permanent: false },
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
