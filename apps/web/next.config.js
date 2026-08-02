/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      { source: '/api/:path*',     destination: `${apiBase}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiBase}/uploads/:path*` },
    ];
  },
};

module.exports = config;
