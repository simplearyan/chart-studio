import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/chart-studio/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editorial: resolve(__dirname, 'editorial.html'),
      },
    },
  },
});

