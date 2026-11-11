import type { NextConfig } from 'next';

/**
 * TAURI_BUILD=1 produces a fully static export in ./out, which the Tauri
 * desktop app (apps/desktop, frontendDist: ../web/out) bundles. Middleware and
 * response headers are not applied in that mode; the desktop app enforces its
 * own CSP via tauri.conf.json.
 */
const isDesktopBuild = process.env.TAURI_BUILD === '1';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isDesktopBuild ? { output: 'export', images: { unoptimized: true }, trailingSlash: true } : {}),
  // Ensure pdfjs-dist and fabric canvas work cleanly on client side
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
    };
    return config;
  },
  ...(isDesktopBuild
    ? {}
    : {
        async headers() {
          return [
            { source: '/:path*', headers: securityHeaders },
            // pdf.js assets are immutable per version — cache aggressively.
            { source: '/pdfjs/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
          ];
        },
      }),
};

export default nextConfig;
