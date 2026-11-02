import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/index.tsx', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'src/mocks/**', 'src/@types/**', 'src/**/*.d.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
