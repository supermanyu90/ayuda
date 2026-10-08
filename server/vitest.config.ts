import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Integration tests share one test database.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
