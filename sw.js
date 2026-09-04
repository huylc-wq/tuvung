/* Service worker: cho phép dùng offline, đồng thời luôn lấy bản mới nhất khi có mạng */
const CACHE = 'tuvung-v4';
const FILES = ['./', './index.html', './app.js?v=4', './vocab.js?v=4', './manifest.json',
               './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    // 'no-cache' = luôn hỏi máy chủ xem file có mới không, thay vì dùng bản cũ trong đệm
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
