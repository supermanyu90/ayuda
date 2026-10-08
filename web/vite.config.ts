/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Local dev: same-origin /api calls are proxied to the API server.
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
});
