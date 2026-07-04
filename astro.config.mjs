// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// DECOROSA — static site, bilingual IT (default, no prefix) / EN (/en/*).
// View Transitions are enabled per-document via <ClientRouter /> in BaseLayout.
// NOTE: update `site` to the final production domain before launch.
export default defineConfig({
  site: 'https://decorosa.art',
  output: 'static',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
