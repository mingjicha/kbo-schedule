const CACHE_NAME = 'kbo-schedule-v8';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/index.css',
  '/styles/common.css',
  '/styles/icons.css',
  '/styles/header.css',
  '/styles/nav.css',
  '/styles/filter.css',
  '/styles/calendar.css',
  '/styles/main.css',
  '/styles/modal.css',
  '/styles/footer.css',
  '/js/constants.js',
  '/js/calendar.js',
  '/js/schedule.js',
  '/js/modal.js',
  '/js/ui.js',
  '/js/onboarding.js',
  '/js/main.js',
  '/fonts/HakgyoansimDunggeunmisoR.woff2',
  '/fonts/symbol-dagger.woff2',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// 이미지·폰트는 내용이 바뀌지 않으므로 캐시를 먼저 쓴다
function isStaticAsset(pathname) {
  return /\.(png|jpg|jpeg|svg|gif|webp|ttf|woff2?)$/i.test(pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API 요청은 캐시하지 않고 항상 네트워크에서 최신 데이터를 받아온다
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 이미지·폰트: 캐시 우선
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML·JS·CSS: 네트워크 우선, 실패하면 캐시로 대체
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
