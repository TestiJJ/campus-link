import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pingPlugin() {
  const pingJson = JSON.stringify({ status: 200, message: 'successfully pinged' });
  return {
    name: 'ping-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const parsedUrl = req.url ? req.url.split('?')[0] : '';
        if (parsedUrl === '/ping' || parsedUrl === '/api/ping') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(pingJson);
          return;
        }
        next();
      });
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) return;

      // Ensure /ping and /api/ping return JSON format on static hosting
      const pingPaths = [
        path.join(distDir, 'ping'),
        path.join(distDir, 'api', 'ping'),
      ];
      for (const p of pingPaths) {
        const parent = path.dirname(p);
        if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
        fs.writeFileSync(p, pingJson);
      }
    }
  };
}

function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-plugin',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) return;
      const indexHtml = fs.readFileSync(indexPath, 'utf-8');

      // 1. Create 404.html fallback for static hosts
      fs.writeFileSync(path.join(distDir, '404.html'), indexHtml);

      // 2. Pre-generate index.html for all primary SPA routes
      const routes = ['login', 'signup', 'dashboard', 'vendor', 'admin', 'auth', 'student-dashboard', 'vendor-dashboard', 'admin-dashboard'];
      for (const route of routes) {
        const routeDir = path.join(distDir, route);
        if (!fs.existsSync(routeDir)) {
          fs.mkdirSync(routeDir, { recursive: true });
        }
        fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml);
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pingPlugin(),
    spaFallbackPlugin(),
  ],
  build: {
    // Target modern browsers — smaller bundles, no legacy polyfills
    target: 'esnext',
    // Minify CSS for smaller payload
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Animation & icon libs — loaded only by dashboards, not landing page
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            // Core React runtime — needed immediately on all pages
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('axios')) {
              return 'vendor-core';
            }
          }
          // Split chatCache into its own chunk — 28KB, loaded early on dashboard mount
          if (id.includes('chatCache')) {
            return 'chatCache';
          }
        },
      },
    },
    // Raise limit — large dashboard files are expected and already lazy-loaded
    chunkSizeWarningLimit: 2000,
  },
});
