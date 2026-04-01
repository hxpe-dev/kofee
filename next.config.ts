import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';
const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://vercel.analytics.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self';
  frame-ancestors 'none';
`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // adding headers for security (CSP)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp.replace(/\n/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;