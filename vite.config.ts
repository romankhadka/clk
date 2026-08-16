import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // served at the domain root: clock.romn.dev
  build: {
    target: 'es2022',
    assetsInlineLimit: 8192,
  },
});
