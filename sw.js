/* GeoVibe service worker: оболочка приложения работает офлайн,
   фото, карта и шрифты кэшируются по мере использования. */
const VERSION = 'gv-0.8.1'
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./apple-touch-icon-precomposed.png",
  "./css/app.css",
  "./css/fonts.css",
  "./css/tokens.css",
  "./css/ui.css",
  "./js/app.js",
  "./js/chat-viewport.js",
  "./js/generator.js",
  "./js/geo.js",
  "./js/install.js",
  "./js/local-places.js",
  "./js/map.js",
  "./js/photo-credits.js",
  "./js/place-photo-overrides.js",
  "./js/place-tools.js",
  "./js/routes.js",
  "./js/stopinfo.js",
  "./js/vector-map.js",
  "./js/wiki.js",
  "./icons/apple-touch-icon-152-v07.png",
  "./icons/apple-touch-icon-167-v07.png",
  "./icons/apple-touch-icon-v07.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/logo.svg",
  "./icons/maskable-512.png",
  "./assets/fonts/onest-variable.ttf",
  "./assets/people/anna.jpg",
  "./assets/photos/bike.jpg",
  "./assets/photos/cafe-1.jpg",
  "./assets/photos/cafe-2.jpg",
  "./assets/photos/cafe-3.jpg",
  "./assets/photos/cafe-4.jpg",
  "./assets/photos/cafe-5.jpg",
  "./assets/photos/coffee.jpg",
  "./assets/photos/credits.json",
  "./assets/photos/kazan.jpg",
  "./assets/photos/moscow.jpg",
  "./assets/photos/moscowSunset.jpg",
  "./assets/photos/moscowVdnh.jpg",
  "./assets/photos/museum.jpg",
  "./assets/photos/park.jpg",
  "./assets/photos/petersburg.jpg",
  "./assets/photos/places/09f2587a61c21c9d.jpg",
  "./assets/photos/places/13931dcbd5a91737.jpg",
  "./assets/photos/places/1541971718413c4f.jpg",
  "./assets/photos/places/1acbdc073b610179.jpg",
  "./assets/photos/places/1c4bae8388e6897f.jpg",
  "./assets/photos/places/1f32171aa1c008e1.jpg",
  "./assets/photos/places/23c149269d2ee0c8.jpg",
  "./assets/photos/places/2624a1bf78e02a88.jpg",
  "./assets/photos/places/302590df4840410c.jpg",
  "./assets/photos/places/390bacc702288b63.jpg",
  "./assets/photos/places/39edca13351422f7.jpg",
  "./assets/photos/places/3bf8f24edc60d4c4.jpg",
  "./assets/photos/places/401ffcad947d50ad.jpg",
  "./assets/photos/places/4142694fa90cf086.jpg",
  "./assets/photos/places/41de4cfc9304e9f9.jpg",
  "./assets/photos/places/48dd8e353b1592af.jpg",
  "./assets/photos/places/4b0251e7b91b8fe3.jpg",
  "./assets/photos/places/53b23cc3acb3a914.jpg",
  "./assets/photos/places/5487e3a485daba54.jpg",
  "./assets/photos/places/56599d18f692c70f.jpg",
  "./assets/photos/places/6017e20b4cdc1b04.jpg",
  "./assets/photos/places/6b5afeb11198b0fa.jpg",
  "./assets/photos/places/6dfa1bd46f6c07f3.jpg",
  "./assets/photos/places/6f4ef2709b10b327.jpg",
  "./assets/photos/places/6fb3002dbfda5900.jpg",
  "./assets/photos/places/71bb3657f5ac2acd.jpg",
  "./assets/photos/places/7839f74fd8528241.jpg",
  "./assets/photos/places/7a7414a0422ef52c.jpg",
  "./assets/photos/places/84f971d671f17a54.jpg",
  "./assets/photos/places/852beeba1c15db93.jpg",
  "./assets/photos/places/884d8cade907c258.jpg",
  "./assets/photos/places/8be8d53ef928d128.jpg",
  "./assets/photos/places/9297648237f62e48.jpg",
  "./assets/photos/places/95c853ec3a035d8f.jpg",
  "./assets/photos/places/aabb5e49c383f5c8.jpg",
  "./assets/photos/places/b146c68f66799636.jpg",
  "./assets/photos/places/b90d3184b78a4d9d.jpg",
  "./assets/photos/places/credits.json",
  "./assets/photos/places/d0713432272bcca5.jpg",
  "./assets/photos/places/d139eab6bb46a21f.jpg",
  "./assets/photos/places/d14faa571f514abf.jpg",
  "./assets/photos/places/d90bef22d0f18a10.jpg",
  "./assets/photos/places/daf1201ea84dfaf0.jpg",
  "./assets/photos/places/db39d8678c2dfef6.jpg",
  "./assets/photos/places/e24807302f531eb8.jpg",
  "./assets/photos/places/eb3fc44cad9e92a4.jpg",
  "./assets/photos/places/ec62bee738c4275f.jpg",
  "./assets/photos/places/ec917cde23210d0a.jpg",
  "./assets/photos/places/ecc0091f087135b0.jpg",
  "./assets/photos/places/f444883697d45a35.jpg",
  "./assets/photos/places/f47d4d277d6045de.jpg",
  "./assets/photos/places/f75e9e293f7c3e62.jpg",
  "./assets/photos/places/ff56b75c6003b71e.jpg",
  "./assets/photos/places/ff9b3993393c4477.jpg",
  "./assets/photos/river.jpg",
  "./assets/photos/suzdal.jpg",
  "./assets/photos/town.jpg",
  "./assets/vendor/leaflet/leaflet.css",
  "./assets/vendor/leaflet/leaflet.js",
  "./assets/vendor/maplibre/maplibre-gl-worker.mjs",
  "./assets/vendor/maplibre/maplibre-gl.css",
  "./assets/vendor/maplibre/maplibre-gl.mjs"
]
const RUNTIME = 'gv-runtime-v11'
const MAX_RUNTIME = 250

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length > MAX_RUNTIME) await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (!/^https?:$/.test(url.protocol)) return

  // страницы: сначала сеть (свежая версия), иначе оболочка из кэша
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    )
    return
  }

  // свои файлы: из кэша, в фоне обновляем
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req)
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || net
      }),
    )
    return
  }

  // GPS route URLs contain coordinates: do not persist them in the runtime cache.
  if (url.hostname === 'routing.openstreetmap.de') return

  // внешнее (фото, плитки карты, шрифты, Leaflet): кэшируем по мере просмотра
  e.respondWith(
    caches.open(RUNTIME).then(async (cache) => {
      const hit = await cache.match(req)
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            cache.put(req, res.clone())
            trim(cache)
          }
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})
