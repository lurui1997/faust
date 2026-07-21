import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tools/**/*.test.ts', 'gallery/src/**/*.test.ts'] } });
