import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one PostgreSQL test database.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000
  }
});
