/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { serverComponentsExternalPackages: ['@career-ops/shared'] },
  transpilePackages: ['@career-ops/shared'],
};
export default nextConfig;
