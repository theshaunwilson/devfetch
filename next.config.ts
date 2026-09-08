import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Clickjacking: nothing in the app is meant to be framed.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Keeps the path and query off cross-origin requests, so a
          // `?token=` in a password-reset or verification link is not handed
          // to whatever a page links out to.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // /api/files/[id] already sets its own, stricter, per-response
          // headers; this is the floor for everything else.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
