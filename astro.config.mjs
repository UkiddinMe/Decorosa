// @ts-check
import { defineConfig } from 'astro/config';

// DECOROSA — static site, bilingual IT (default, no prefix) / EN (/en/*).
// View Transitions are enabled per-document via <ClientRouter /> in BaseLayout.
export default defineConfig({
  output: 'static',
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
