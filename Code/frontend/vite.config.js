import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The browser only ever talks to the Vite dev server (same origin). The dev server
// proxies /api to the API Gateway and attaches x-api-key itself, so the gateway key
// is read from the root .env at server start and is NEVER bundled into client code.
export default defineConfig(({ mode }) => {
  const root = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const gateway = root.GATEWAY_URL || `http://localhost:${root.GATEWAY_PORT || 4000}`;
  const proxy = {
    '/api': {
      target: gateway,
      changeOrigin: true,
      headers: { 'x-api-key': root.GATEWAY_API_KEY || '' },
    },
    '/gateway-health': { target: gateway, changeOrigin: true, rewrite: () => '/health' },
  };
  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 5173, proxy },
  };
});
