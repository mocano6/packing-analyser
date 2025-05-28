/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@firebase/firestore', '@firebase/auth', '@firebase/storage'],
  },
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        url: require.resolve('url'),
        zlib: require.resolve('browserify-zlib'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        assert: require.resolve('assert'),
        os: require.resolve('os-browserify'),
        path: require.resolve('path-browserify'),
        'process/browser': require.resolve('process/browser'),
      };
    }

    // Dodajemy obsługę modułów ESM
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    // Konfiguracja cache
    if (dev) {
      config.cache = {
        type: 'filesystem',
        version: '1.0.0',
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: '.next/cache',
        maxAge: 172800000, // 2 dni
        compression: 'gzip',
        allowCollectingMemory: true,
        idleTimeout: 60000,
        idleTimeoutForInitialStore: 5000,
        store: 'pack',
        name: 'next-cache',
      };
    }

    return config;
  },
}

module.exports = nextConfig 