import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@arcanora/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@arcanora/database': path.resolve(__dirname, '../../packages/database/src/index.ts')
    }
  },
  esbuild: {
    target: 'esnext'
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext'
  },
  server: {
    port: 5173,
    host: true
  }
});
