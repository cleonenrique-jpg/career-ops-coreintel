/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@career-ops/shared'],
  async redirects() {
    return [
      // Legacy paths consolidated into home / profile / sistema
      { source: '/pipeline',     destination: '/',                permanent: false },
      { source: '/applications', destination: '/',                permanent: false },
      { source: '/dashboard',    destination: '/',                permanent: false },
      { source: '/cv',           destination: '/profile?tab=cv',  permanent: false },
      { source: '/portals',      destination: '/sistema?tab=fuentes', permanent: false },
      { source: '/scan',         destination: '/sistema?tab=scans',   permanent: false },
    ];
  },
};
export default nextConfig;
