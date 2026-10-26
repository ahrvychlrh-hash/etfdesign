/**
 * 홈 화면 앱(PWA)용 서비스 워커.
 * - 화면(HTML)은 항상 인터넷에서 먼저 받아 새 버전이 바로 보이게, 안 되면 저장해 둔 화면으로 엶
 * - 빌드된 파일(/assets/…, 이름에 버전이 들어 있음)과 아이콘은 한 번 받으면 저장해 두고 씀
 * - 시세 등 /api/ 요청은 저장하지 않음 (항상 최신)
 */
const CACHE = 'etf-design-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // 화면: 인터넷 먼저, 안 되면 저장본
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // 그 밖의 파일: 저장본 먼저, 없으면 받아서 저장
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
