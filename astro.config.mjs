// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://rafolabs.tech',
  // Mantém as páginas do site pré-renderizadas; somente a rota do webhook
  // opta por renderização sob demanda.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
});
