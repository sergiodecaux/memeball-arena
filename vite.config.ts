import { defineConfig } from 'vite';

export default defineConfig({
  base: '/memeball-arena/',
  
  build: {
    target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13'],
    polyfillModulePreload: true,

    // Генерируем уникальные хэши для cache busting
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
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
    strictPort: false,
    headers: {
      'Cache-Control': 'no-store',
    },
  },

  optimizeDeps: {
    include: ['phaser'],
  },
  
  publicDir: 'public',
});
