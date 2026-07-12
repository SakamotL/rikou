// 日课 PWA Service Worker —— 离线缓存静态资源 + 接收 Web Push 推送
const CACHE = 'rikou-v3';
const FILES = ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const c = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, c));
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
  );
});

/* ================= Web Push ================= */
self.addEventListener('push', e => {
  let data = { title: '日迹', body: '', tag: 'rikou', url: '/' };
  if (e.data) {
    try { data = Object.assign(data, e.data.json()); }
    catch (_) { data = Object.assign(data, { body: e.data.text() }); }
  }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body || '',
    icon: 'icon.svg',
    badge: 'icon.svg',
    tag: data.tag || 'rikou',
    renotify: !!data.tag,
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

