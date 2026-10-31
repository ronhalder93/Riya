const CACHE = 'riya-shell-v15';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./avatar.js','./manifest.webmanifest','./room-image.b64'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('riya-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isShell = url.pathname.endsWith('/') || /\.(html|js|css|webmanifest|b64)$/.test(url.pathname);
  if (isShell) {
    event.respondWith(fetch(event.request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request)));
  } else {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
  }
});
