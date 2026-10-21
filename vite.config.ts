import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:8080' },
  },
});
