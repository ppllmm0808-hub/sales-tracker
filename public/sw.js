// 버전 바꾸면 모든 캐시 삭제됨
const CACHE_VERSION = 'v2'

self.addEventListener('install', () => {
  self.skipWaiting() // 즉시 활성화
})

self.addEventListener('activate', (event) => {
  // 이전 버전 캐시 전부 삭제
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // 즉시 모든 탭 제어
  )
})

// HTML 페이지: 항상 네트워크 우선 (캐시 사용 안 함)
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 같은 오리진의 HTML 요청 → 항상 네트워크에서
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // JS/CSS 등 정적 자산: 네트워크 우선, 실패 시 캐시
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request))
    )
  }
})
