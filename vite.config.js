/*
 * Vite: compila la app React a dist/ y genera el service worker (PWA) con las mismas
 * estrategias que el sw.js de la version anterior: la app desde cache y red, fotos y fuentes externas con cache.
 */
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const MONTH = 30 * 24 * 60 * 60;

/* "vite preview" usa la misma Content-Security-Policy que Netlify (netlify.toml), para probarla en local */
function netlifyCsp() {
  const match = readFileSync(new URL('./netlify.toml', import.meta.url), 'utf8').match(/Content-Security-Policy = "([^"]+)"/);
  return match ? match[1].replace('; upgrade-insecure-requests', '') : '';
}

/*
 * GitHub Pages (copia de la app): se publica en https://<usuario>.github.io/foxtrips-viajes/ y no admite
 * cabeceras ni funciones. Por eso la ruta base cambia y la CSP va en una etiqueta <meta> (sin frame-ancestors,
 * que solo funciona como cabecera). Netlify sigue siendo la direccion principal, con cabeceras completas.
 */
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

function pagesCspPlugin() {
  return {
    name: 'foxtrips-pages-csp',
    transformIndexHtml(html) {
      if (!isGitHubPages) return html;
      const csp = netlifyCsp().replace(/;\s*frame-ancestors[^;]*/, '');
      return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
    }
  };
}

export default defineConfig({
  base: isGitHubPages ? '/foxtrips-viajes/' : '/',
  plugins: [
    react(),
    pagesCspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      // El manifiesto ya existe en public/manifest.webmanifest (mismo nombre, iconos y colores)
      manifest: false,
      includeAssets: ['assets/img/*.png', 'manifest.webmanifest'],
      workbox: {
        // La pagina (index.html) NO se precarga: se pide primero a la red para que lleguen siempre
        // las cabeceras de seguridad nuevas (CSP). Sin conexion se usa la ultima copia guardada.
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Avisos push (public/push-sw.js): mostrar el aviso y abrir la app al pulsarlo
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' && !url.pathname.includes('/api/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'foxtrips-paginas', networkTimeoutSeconds: 4, expiration: { maxEntries: 5 } }
          },
          {
            // Fuentes de Google: cache primero
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'foxtrips-fuentes', expiration: { maxEntries: 30, maxAgeSeconds: 12 * MONTH } }
          },
          {
            // Fotos externas (Wikimedia, Cloudinary) y teselas del mapa: cache primero
            urlPattern: ({ url, request }) => request.destination === 'image'
              && ['wikimedia.org', 'res.cloudinary.com', 'tile.openstreetmap.org'].some((host) => url.hostname.endsWith(host)),
            handler: 'CacheFirst',
            options: { cacheName: 'foxtrips-fotos', expiration: { maxEntries: 400, maxAgeSeconds: MONTH }, cacheableResponse: { statuses: [0, 200] } }
          }
        ]
      }
    })
  ],
  server: { port: 5173 },
  preview: { headers: { 'Content-Security-Policy': netlifyCsp() } },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 800 }
});
