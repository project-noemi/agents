import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'noemi-ea-admin.js',
        assetFileNames: 'noemi-ea-admin.[ext]'
      }
    }
  }
});
