import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API runs on 4001 locally (see build guide, section 8). Override with VITE_API_PROXY.
const target = process.env.VITE_API_PROXY || 'http://localhost:4001';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { port: 5173, host: true, proxy: { '/api': { target, changeOrigin: true } } },
});
