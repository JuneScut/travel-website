import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';

function redirectAdminEntry(request, response, next) {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname !== '/admin') return next();
  response.writeHead(302, { Location: `/admin/${url.search}` });
  response.end();
}

export default defineConfig({
  plugins: [react(), {
    name: 'admin-entry-redirect',
    configureServer(server) {
      server.middlewares.use(redirectAdminEntry);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectAdminEntry);
    },
  }, {
    name: 'preserve-static-content',
    closeBundle() {
      cpSync('assets', 'dist/assets', { recursive: true });
      cpSync('admin', 'dist/admin', { recursive: true });
      mkdirSync('dist/src', { recursive: true });
      cpSync('src/trips.js', 'dist/src/trips.js');
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
