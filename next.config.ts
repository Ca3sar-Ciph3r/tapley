import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ISR is enabled by default in Next.js — do not set output: 'export' or force-dynamic globally.
  // Individual routes control their caching strategy via route segment config.
  images: {
    remotePatterns: [
      {
        // Supabase Storage — allow images from the project's storage bucket
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
