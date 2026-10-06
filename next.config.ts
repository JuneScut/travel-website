import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  agentRules: false,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  poweredByHeader: false,
  serverExternalPackages: ['argon2', 'sharp', 'pg', 'busboy'],
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
};
export default config;
