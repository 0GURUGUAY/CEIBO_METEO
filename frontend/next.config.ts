import type { NextConfig } from 'next';

const isStaticExport = process.env.STATIC_EXPORT === 'true';
const basePath = process.env.SITE_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: 'export' as const,
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
        basePath,
        assetPrefix: basePath || undefined,
      }
    : {}),
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
