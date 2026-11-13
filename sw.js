// Uso sin conexión.
// - La página y los archivos de la app: primero la red (para ver siempre la última versión) y, sin conexión, la copia guardada.
// - El lector OCR (~10 MB, no cambia): primero la copia guardada.
const VERSION = 'v6';
const FILES = ['./', 'index.html', 'foods.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'ocr/label.js'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(VERSION)
    // cache:'reload' evita guardar copias viejas de la caché HTTP del navegador
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting())
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isOCR = url.pathname.includes('/ocr/') && !url.pathname.endsWith('label.js');

  if (isOCR) { // primero caché
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
      return res;
    })));
    return;
  }
  // primero red, sin caché HTTP; si falla, copia guardada
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
