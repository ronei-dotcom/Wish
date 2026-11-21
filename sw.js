// Guarda os arquivos do app para abrir rápido e funcionar sem internet.
const CACHE = 'wishlist-v1';
const SHELL = ['./', 'index.html', 'style.css?v=1', 'app.js?v=1', 'config.js?v=1', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Arquivos do próprio app: tenta a internet primeiro (pega versão nova) e cai no cache se estiver offline.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: u.pathname.endsWith('/') }).then(r => r || caches.match('./')))
  );
});
