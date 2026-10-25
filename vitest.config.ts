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
    // Memory bound: cap the worker count and give every worker a V8 heap ceiling, so a leaking test file fails with an OOM
    // instead of exhausting the machine.
    maxWorkers: 4,
    execArgv: ['--max-old-space-size=2048'],
    include: [
      'shared/src/**/*.test.ts',
      'src/components/**/*.test.tsx',
      'src/lib/**/*.test.ts',
      'src/scripts/**/*.test.ts',
    ],
    environment: 'node',
  },
});
