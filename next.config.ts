import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ['*.trycloudflare.com'],
  images: { localPatterns: [{ pathname: '/images/**' }] },
};
export default nextConfig;
