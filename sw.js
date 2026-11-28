// Davis Home Inspections - Field App Offline Service Worker (v87)
// Caches inspect.html and its core CDN libraries so the Field App still opens
// if the browser reloads in a zero-signal basement or rural property.
// Never intercepts Supabase API/storage requests or non-GET requests.

const CACHE_NAME = 'dhi-field-shell-v2.0.18-ai';
const SHELL_URLS = [
  './inspect.html',
  './field-manifest.json',
  './dhi_favicon_badge.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        SHELL_URLS.map((url) =>
          fetch(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' })
            .then((res) => { if (res && (res.ok || res.type === 'opaque')) return cache.put(url, res); })
            .catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('dhi-field-shell-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept Supabase backend, weather APIs, or external lookups
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('weather.gov') || url.hostname.includes('open-meteo.com')) {
    return;
  }

  const isFieldShell =
    url.pathname.endsWith('/inspect.html') ||
    url.pathname.endsWith('/field-manifest.json') ||
    url.pathname.endsWith('/dhi_favicon_badge.png') ||
    url.hostname === 'cdn.tailwindcss.com' ||
    url.hostname === 'cdn.jsdelivr.net';

  if (!isFieldShell) return;

  // Network-first so updates always land when online, falling back to cache when offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
