import { defineConfig } from 'vite';

export default defineConfig({
  base: '/clockwork/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 8192,
  },
});
