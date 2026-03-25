import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared/src'),
    },
  },
  test: {
    include: [
      'shared/src/**/*.test.ts',
      'src/components/**/*.test.tsx',
    ],
    environment: 'node',
  },
});
