import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ['@denco/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
    ],
  },
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.symlinks = false;
    // Force single instance of Mantine packages and resolve @denco/ui subpath exports
    const dencoUiPath = path.resolve(__dirname, 'node_modules/@denco/ui');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@denco/ui/styles/components.css': path.resolve(dencoUiPath, 'styles/components.css'),
      '@denco/ui/styles/variables.css': path.resolve(dencoUiPath, 'styles/variables.css'),
      '@denco/ui/utils': path.resolve(dencoUiPath, 'dist/utils/index.js'),
      '@denco/ui/components': path.resolve(dencoUiPath, 'dist/components/index.js'),
      '@denco/ui/auth': path.resolve(dencoUiPath, 'dist/auth/index.js'),
      '@denco/ui/api': path.resolve(dencoUiPath, 'dist/api/index.js'),
      '@denco/ui/stores': path.resolve(dencoUiPath, 'dist/stores/index.js'),
      '@denco/ui/theme': path.resolve(dencoUiPath, 'dist/theme/index.js'),
      '@denco/ui/constants': path.resolve(dencoUiPath, 'dist/constants/index.js'),
      '@denco/ui': path.resolve(dencoUiPath, 'dist/index.js'),
      '@mantine/core': path.resolve(__dirname, 'node_modules/@mantine/core'),
      '@mantine/hooks': path.resolve(__dirname, 'node_modules/@mantine/hooks'),
      '@mantine/notifications': path.resolve(__dirname, 'node_modules/@mantine/notifications'),
      '@mantine/dates': path.resolve(__dirname, 'node_modules/@mantine/dates'),
      '@mantine/charts': path.resolve(__dirname, 'node_modules/@mantine/charts'),
      '@mantine/modals': path.resolve(__dirname, 'node_modules/@mantine/modals'),
    };
    return config;
  },
};

export default nextConfig;
