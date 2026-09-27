import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@brokeriq/shared'],
  // Images are served from Cloudinary / S3 CDNs with on-the-fly transforms, so Next's
  // optimizer is disabled to keep hosting free (no Vercel image-optimization quota).
  images: { unoptimized: true },
  poweredByHeader: false,
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
