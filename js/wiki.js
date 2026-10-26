import { LOCAL_PLACES } from './local-places.js'
/* Фото и краткие справки о местах из Википедии (ru) и Wikimedia Commons.
   Запрос идёт из браузера пользователя; результат кэшируется в localStorage на 30 дней.
   Если интернета нет — функции возвращают null, а приложение показывает свои тексты. */

const API = 'https://ru.wikipedia.org/w/api.php'
const KEY = 'geovibe:wiki:v1'
const TTL = 30 * 24 * 3600 * 1000
const BAD = /flag|logo|coat|герб|флаг|map|карта|схема|plan|icon|symbol|commons-|question|wikidata|stub|police|sign|diagram|chart|seal|emblem/i

let cache
const mem = new Map()
const readCache = () => {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { cache = {} }
  return cache
}
const writeCache = () => {
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* переполнено — не критично */ }
}

async function getJson(params, ms = 7000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

const text = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

async function fetchPlace(q) {
  const a = await getJson({
    action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '1', gsrnamespace: '0',
    prop: 'pageimages|extracts|info', piprop: 'thumbnail', pithumbsize: '1100',
    exintro: '1', explaintext: '1', exsentences: '3', inprop: 'url', redirects: '1',
  })
  const page = a?.query?.pages && Object.values(a.query.pages)[0]
  if (!page) return { none: true }
  const place = {
    title: page.title,
    extract: page.extract || '',
    thumb: page.thumbnail?.source || '',
    url: page.fullurl || `https://ru.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    photos: [],
  }
  try {
    const g = await getJson({
      action: 'query', generator: 'images', titles: page.title, gimlimit: '40',
      prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1100',
      iiextmetadatafilter: 'Artist|LicenseShortName',
    })
    const pics = Object.values(g?.query?.pages || {})
      .map((p) => ({ name: p.title || '', i: p.imageinfo?.[0] }))
      .filter(({ name, i }) => i && i.mime === 'image/jpeg' && i.width >= 900 && i.height >= 500 && !BAD.test(name))
      .map(({ name, i }) => ({
        url: i.thumburl || i.url,
        w: i.width,
        h: i.height,
        wide: i.width / i.height >= 2.3,
        credit: text(i.extmetadata?.Artist?.value).slice(0, 60),
        license: text(i.extmetadata?.LicenseShortName?.value),
        page: i.descriptionurl,
        name: name.replace(/^Файл:|^File:/, ''),
      }))
    // обложка статьи — первой, остальные по порядку
    pics.sort((x, y) => Number(y.url === place.thumb) - Number(x.url === place.thumb))
    place.photos = pics.slice(0, 8)
  } catch { /* галерея не обязательна */ }
  return place
}

/** Возвращает данные места или null. Одновременные запросы схлопываются. */
export function loadPlace(q) {
  if (!q) return Promise.resolve(null)
  if (LOCAL_PLACES[q]) return Promise.resolve(LOCAL_PLACES[q])
  const c = readCache()
  const hit = c[q]
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.none ? null : hit.v)
  if (mem.has(q)) return mem.get(q)
  const p = fetchPlace(q)
    .then((v) => {
      c[q] = v.none ? { at: Date.now(), none: true } : { at: Date.now(), v }
      writeCache()
      return v.none ? null : v
    })
    .catch(() => null)
    .finally(() => mem.delete(q))
  mem.set(q, p)
  return p
}
