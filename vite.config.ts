import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // served at the domain root: clk.romn.dev
  build: {
    target: 'es2022',
    assetsInlineLimit: 8192,
  },
});
