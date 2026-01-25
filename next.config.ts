import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images from OpenAI (oaidalleapiprodscus.blob.core.windows.net)
    // and other common image hosting domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: '**.openai.com',
      },
      // Allow PartyKit localhost for development
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1999',
        pathname: '/parties/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '1999',
        pathname: '/parties/**',
      },
      // Allow PartyKit production domains
      {
        protocol: 'https',
        hostname: '**.partykit.dev',
        pathname: '/parties/**',
      },
      // Cloudinary (character images)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    // Optimize images for web
    formats: ['image/avif', 'image/webp'],
    // Ensure square aspect ratio is maintained
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  /**
   * Security headers (T202).
   *
   * These headers implement a conservative baseline that can be
   * tightened further once deployment domains are finalized.
   */
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // In development, allow WebSocket + HTTP fetch to PartyKit dev server.
    // Explicit host:port (1999) — some CSP implementations don't match http://localhost:* for fetch.
    // Production: https: allows fetch to PartyKit GET /state; wss: required for PartySocket
    // (connect-src https: does NOT allow wss: — WebSocket scheme must be explicit).
    const connectSrc = isDevelopment
      ? "connect-src 'self' https: http://localhost:1999 http://127.0.0.1:1999 ws://localhost:1999 ws://127.0.0.1:1999 ws://localhost:* ws://127.0.0.1:*"
      : "connect-src 'self' https: wss:";
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Note: adjust script-src and connect-src as needed for production.
            // In development, allows localhost WebSocket connections for PartyKit.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Allow images from PartyKit in development (localhost:1999) and production (partykit.dev)
              isDevelopment
                ? "img-src 'self' data: https: blob: http://localhost:1999 http://127.0.0.1:1999"
                : "img-src 'self' data: https: blob: https://*.partykit.dev",
              "font-src 'self' data:",
              connectSrc,
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
