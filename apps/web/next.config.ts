import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@brokeriq/shared'],
  // Images are served from Cloudinary / S3 CDNs with on-the-fly transforms, so Next's
  // optimizer is disabled to keep hosting free (no Vercel image-optimization quota).
  images: { unoptimized: true },
  poweredByHeader: false,
  // Broker-first pivot: consumer & marketplace entrypoints redirect to broker login (/login).
  // Old routes are kept intact for future rollout.
  async redirects() {
    return [
      { source: '/', destination: '/login', permanent: false },
      { source: '/broker/login', destination: '/login', permanent: false },
      { source: '/buy', destination: '/login', permanent: false },
      { source: '/rent', destination: '/login', permanent: false },
      { source: '/plots', destination: '/login', permanent: false },
      { source: '/projects', destination: '/login', permanent: false },
      { source: '/projects/:slug*', destination: '/login', permanent: false },
      { source: '/account', destination: '/login', permanent: false },
      { source: '/account/:path*', destination: '/login', permanent: false },
      { source: '/search', destination: '/login', permanent: false },
      { source: '/property/:path*', destination: '/login', permanent: false },
      { source: '/locality/:path*', destination: '/login', permanent: false },
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
