// WALDWACHT - minimaler Offline-Cache fuer die installierte App.
// Alles steckt in index.html selbst, deshalb reicht ein kleiner App-Shell-Cache.
const CACHE = 'waldwacht-v2';
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first fuer index.html (frische Version, wenn online), sonst Cache.
// Nur eigene Dateien: Verbindungsdienste fuers Zweierspiel (PeerJS) laufen ungecacht durch.
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
