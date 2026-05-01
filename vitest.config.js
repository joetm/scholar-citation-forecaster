import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['test/dom/**', 'jsdom'],
      ['test/content.test.js', 'jsdom']
    ],
    globals: false,
    include: ['test/**/*.test.js']
  }
});
