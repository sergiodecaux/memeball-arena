// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  // ВАЖНО: укажите имя будущего репозитория
  base: '/memeball-arena/',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});