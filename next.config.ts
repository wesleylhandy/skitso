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
    ],
    // Optimize images for web
    formats: ['image/avif', 'image/webp'],
    // Ensure square aspect ratio is maintained
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
