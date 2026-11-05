import { defineConfig } from 'vite';
import { localUpdates } from './tooling/local-version.js';
export default defineConfig({
  plugins: [localUpdates()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // HTTP polling works on Windows/Wi-Fi even when the HMR websocket is blocked.
    hmr: false,
    watch: { usePolling: true, interval: 500 },
    proxy: { '/api': process.env.SL_API_TARGET || 'http://127.0.0.1:3001' },
  },
});
