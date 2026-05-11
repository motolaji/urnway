import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(configDirectory, '..'),
  transpilePackages: [
    '@urnway/contracts',
    '@mezo-org/passport',
    '@mezo-org/orangekit',
    '@mezo-org/orangekit-smart-account',
    '@mezo-org/orangekit-contracts',
    '@mezo-org/mezo-clay',
  ],
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias['pino-pretty'] = path.join(
      configDirectory,
      'lib',
      'pino-pretty-stub.cjs'
    );

    return config;
  },
};

export default nextConfig;
