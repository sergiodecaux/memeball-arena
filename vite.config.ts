// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',  // Точка вместо /memeball-arena/
  
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});