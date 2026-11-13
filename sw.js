// Cache para uso sin conexión. Sube VERSION al cambiar archivos.
const VERSION='v3', FILES=['./','index.html','foods.js','manifest.json','icon.svg','icon-192.png','icon-512.png','ocr/label.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// El lector OCR (~10 MB) no se precarga: se guarda en caché la primera vez que se usa
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{
  if(res.ok&&e.request.method==='GET'&&new URL(e.request.url).pathname.includes('/ocr/')){const c=res.clone();caches.open(VERSION).then(x=>x.put(e.request,c))}
  return res;}))));
