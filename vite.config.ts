import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  
  build: {
    // Генерируем уникальные хэши для cache busting
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    // Генерируем manifest.json для отслеживания файлов
    manifest: true,
    
    // Минификация
    minify: 'esbuild',
    
    // Source maps для production (опционально)
    sourcemap: false,
    
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 2000,
    copyPublicDir: true,
  },
  
  // Отключаем кэширование в dev режиме
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  
  publicDir: 'public',
});
