const CACHE = 'bidon-v4.5';
const DOSYALAR = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname.includes('script.google.com') || u.hostname.includes('googleusercontent.com')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.status === 200) {
        const kopya = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, kopya));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
