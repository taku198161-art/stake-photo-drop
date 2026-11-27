// StakePhotoDrop Service Worker（オフライン用）
// 写真・座標・入力データは扱いません。アプリ本体（HTML・アイコン・PDF部品）だけを端末に保存します。
// 起動時はまず端末内の保存分で表示し、電波があれば裏で最新版を取り込みます（次回起動で反映）。
const VERSION = 'spd-v1.4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './StakePhotoDrop.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // PDF部品は取れなくても入れ直しを止めない
    await Promise.all(LIBS.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('spd-') && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isLib = LIBS.includes(req.url);
  if (!sameOrigin && !isLib) return; // 地図・その他の外部通信には関与しない

  // 画面（HTML）は index.html の保存分を使う
  const key = req.mode === 'navigate' ? new URL('./index.html', self.location).href : req;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const fresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(fresh);
      return cached;
    }
    const res = await fresh;
    return res || new Response('オフラインのため読み込めません', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
