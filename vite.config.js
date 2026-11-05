/*
 * Vite: compila la app React a dist/ y genera el service worker (PWA) con las mismas
 * estrategias que el sw.js de la version anterior: la app desde cache y red, fotos y fuentes externas con cache.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const MONTH = 30 * 24 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El manifiesto ya existe en public/manifest.webmanifest (mismo nombre, iconos y colores)
      manifest: false,
      includeAssets: ['assets/img/*.png', 'manifest.webmanifest'],
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        runtimeCaching: [
          {
            // Fuentes de Google: cache primero
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'foxtrips-fuentes', expiration: { maxEntries: 30, maxAgeSeconds: 12 * MONTH } }
          },
          {
            // Fotos externas (Wikimedia, Cloudinary) y teselas del mapa: cache primero
            urlPattern: ({ url, request }) => request.destination === 'image'
              && ['upload.wikimedia.org', 'res.cloudinary.com', 'tile.openstreetmap.org'].some((host) => url.hostname.endsWith(host)),
            handler: 'CacheFirst',
            options: { cacheName: 'foxtrips-fotos', expiration: { maxEntries: 400, maxAgeSeconds: MONTH }, cacheableResponse: { statuses: [0, 200] } }
          }
        ]
      }
    })
  ],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false }
});
