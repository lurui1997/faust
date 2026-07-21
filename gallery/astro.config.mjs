import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.FAUST_SITE ?? 'https://lurui1997.github.io',
  base: process.env.FAUST_BASE ?? '/faust',
  output: 'static',
  trailingSlash: 'always',
});
