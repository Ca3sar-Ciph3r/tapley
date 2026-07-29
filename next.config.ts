import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ISR is enabled by default in Next.js — do not set output: 'export' or force-dynamic globally.
  // Individual routes control their caching strategy via route segment config.
  eslint: {
    // Warnings only — do not fail the build on lint warnings
    ignoreDuringBuilds: true,
  },
  // NOTE: typescript.ignoreBuildErrors was set here and is deliberately gone.
  // It was hiding 78 real type errors from every production deploy — the data
  // layer had collapsed to `never`, so nothing in it was type-checked at all.
  // Suppressing the check does not make the code correct, it makes the
  // breakage invisible. Fix errors rather than reinstating this.
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
