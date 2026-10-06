import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Same-origin /api in development so the session cookie stays first-party and SameSite=Lax.
    proxy: { '/api': { target: api, changeOrigin: false, ws: true } }
  },
  preview: { host: '127.0.0.1', port: 4173, proxy: { '/api': { target: api, ws: true } } },
  build: { target: 'es2023', sourcemap: true }
});
