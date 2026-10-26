import { syncChatViewport, initChatViewport } from './chat-viewport.js'
import { isIOS, isStandalone as standalone, initInstallPrompt, refreshInstallPrompt } from './install.js'
import { placeData } from './place-tools.js'
import { CATALOG, CITIES, TRANSPORTS, STOP_POOL } from './routes.js'
import { PHOTO_CREDITS } from './photo-credits.js'
import { dist, fmtCost, fmtH, fmtKm, meta } from './geo.js'
import { findReplacement, generate, parseQuery, mergeQuery, weatherFor } from './generator.js'
import { BEST_ICON, STOPINFO } from './stopinfo.js'
import { loadPlace } from './wiki.js'
import { drawMap } from './map.js'

/* ───────────────────────── утилиты ───────────────────────── */
const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const baseId = (id) => id.replace(/^gen-/, '').replace(/-\d{10,}$/, '')
const first = (s) => (s || '?').trim()[0].toUpperCase()

/* Цвет «линии метро» и небо обложки — по городу */
const CITY = {
  'Москва': { line: '#12AD89', sky: ['#2B1B4E', '#F0765A'] },
  'Санкт-Петербург': { line: '#4B85AF', sky: ['#17284F', '#86AEE8'] },
  'Казань': { line: '#849A46', sky: ['#0F3550', '#52C7A2'] },
  'Коломна': { line: '#8C76B5', sky: ['#2A2056', '#CE90E2'] },
  'Суздаль': { line: '#C77C64', sky: ['#3A2A1A', '#F3B764'] },
}
const lineColor = (city) => (CITY[city] || CITY['Москва']).line

/* ───────────────────────── иконки ───────────────────────── */
const ic = (body, s = 18, fill = 'none') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
const I = {
  sun: (s) => ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>', s),
  home: (s) => ic('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', s),
  spark: (s) => ic('<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>', s),
  heart: (s, f) => ic('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>', s, f ? 'currentColor' : 'none'),
  user: (s) => ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>', s),
  search: (s) => ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', s),
  back: (s) => ic('<path d="M15 5l-7 7 7 7"/>', s),
  pin: (s) => ic('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>', s),
  walk: (s) => ic('<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2-6 3 2v4M10.5 9.5l3-1 2 3 3 1M11 15l-1-5 3.5-1.5"/>', s),
  clock: (s) => ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  star: (s) => ic('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', s, 'currentColor'),
  starO: (s) => ic('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', s),
  send: (s) => ic('<path d="M3 11l18-8-8 18-2-8z"/>', s, 'currentColor'),
  swap: (s) => ic('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', s),
  check: (s) => ic('<path d="M5 12l5 5 9-10"/>', s),
  plus: (s) => ic('<path d="M12 5v14M5 12h14"/>', s),
  share: (s) => ic('<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', s),
  wallet: (s) => ic('<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2"/><circle cx="16.5" cy="14" r="1.2"/>', s),
  umbrella: (s) => ic('<path d="M12 3a9 9 0 0 0-9 9h18a9 9 0 0 0-9-9z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>', s),
  download: (s) => ic('<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>', s),
  globe: (s) => ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', s),
  nav: (s) => ic('<path d="M4 12l16-8-8 16-2-6z"/>', s),
  bulb: (s) => ic('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>', s),
  lock: (s) => ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', s),
}

/* ───────────────────────── данные и состояние ───────────────────────── */
const KEY = 'geovibe:v2'
const load = () => {
  try {
    return { favs: [], follows: [], done: [], mine: [], flags: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { favs: [], follows: [], done: [], mine: [], flags: {} }
  }
}
let S = load()
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S))
  } catch {
    /* приватный режим */
  }
}
const all = () => [...S.mine, ...CATALOG]
const isFav = (id) => S.favs.some((r) => baseId(r.id) === baseId(id))

const F = { city: 'all', tr: 'all', time: 'all', q: '', tag: '' }
const ctx = {
  result: null,
  plan: null,
  walk: null,
  prefill: '',
  chat: [],
  chatQuery: null,
  chatDraft: '',
  chatJob: null,
  pending: '',
  busy: false,
  rateOpen: false,
  rating: 0,
  profileTab: 'mine',
  favCity: 'all',
  create: { title: '', desc: '', city: 'Москва', tr: 'Пешком', picked: [] },
}

let toastTimer
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200)
}

/* ───────────────────────── обложки ───────────────────────── */
function hash(s) {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function skyline(seed) {
  let x = hash(seed) || 1
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296)
  let back = ''
  let front = ''
  for (let i = 0, px = -4; px < 410; i++) {
    const w = 10 + rnd() * 18
    const h = 28 + rnd() * 52
    back += `<rect x="${px.toFixed(1)}" y="${(120 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`
    px += w + rnd() * 3
  }
  for (let px = -6; px < 410; ) {
    const w = 12 + rnd() * 24
    const h = 14 + rnd() * 40
    front += `<rect x="${px.toFixed(1)}" y="${(120 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`
    if (rnd() > 0.82) front += `<path d="M${(px + w / 2 - 3).toFixed(1)} ${(120 - h).toFixed(1)}l3-22 3 22z"/>`
    px += w + rnd() * 5
  }
  const sx = 60 + rnd() * 280
  return `<svg class="sky-art" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="${sx.toFixed(0)}" cy="46" r="26" fill="rgba(255,255,255,.28)"/>
    <g fill="rgba(19,22,43,.34)">${back}</g><g fill="rgba(19,22,43,.62)">${front}</g></svg>`
}
function cover(r, inner = '', cls = '') {
  const c = CITY[r.city] || CITY['Москва']
  const photo = CATALOG.find(item=>item.id===baseId(r.id))?.photo || r.photo
  const img = photo
    ? `<img src="${esc(photo)}" alt="" width="900" height="600" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : ''
  return `<div class="cover ${cls}" style="--a:${c.sky[0]};--b:${c.sky[1]}">${skyline(r.id.replace(/^gen-/, ''))}${img}${inner}</div>`
}
const likeBadge = (n) => `<span class="like">${I.heart(13, true)}${n}</span>`
const fact = (icon, text) => `<span class="fact">${I[icon](15)}${esc(text)}</span>`
const lineBadge = (city) =>
  `<span class="lnbadge"><i style="background:${lineColor(city)}"></i>${esc(city)}</span>`


const plural = (n, f) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? f[1] : f[2]}`

/** Фирменная «схема линий»: несколько цветных линий с пересадкой. Рисуется один раз при появлении. */
function metroArt() {
  const L = [
    ['#12AD89', 'M10 196 C 80 196, 92 122, 152 122 S 236 62, 322 62', [[10, 196], [152, 122], [322, 62]], 0],
    ['#4B85AF', 'M22 40 C 92 40, 112 100, 152 122 S 240 192, 342 192', [[22, 40], [152, 122], [342, 192]], 0.25],
    ['#849A46', 'M70 232 C 96 176, 124 150, 152 122 S 208 44, 236 8', [[70, 232], [152, 122], [236, 8]], 0.5],
    ['#C77C64', 'M338 112 C 280 112, 246 150, 204 156 S 126 222, 96 222', [[338, 112], [204, 156], [96, 222]], 0.75],
  ]
  return `<svg class="metro" viewBox="0 0 360 240" aria-hidden="true">${L.map(
    ([c, d, st, dl]) =>
      `<path class="mline" pathLength="1" d="${d}" stroke="${c}" style="--d:${dl}s"/>` +
      st.map(([x, y], i) => (x === 152 && y === 122 ? '' : `<circle class="mst" cx="${x}" cy="${y}" r="7" style="--d:${(dl + 0.5 + i * 0.2).toFixed(2)}s"/>`)).join(''),
  ).join('')}<circle class="mst hub" cx="152" cy="122" r="11" style="--d:1.4s"/></svg>`
}

/** Нарисованная обложка для места; настоящая фотография ложится поверх, когда загрузится */
function artBox(cls, stop, inner = '') {
  const c = CITY[stop.city] || CITY['Москва']
  const local = placeData(stop)
  const photo = local?.photos?.[0]
  const credit=photo?`<a class="local-photo-credit" href="${esc(photo.page)}" target="_blank" rel="noopener">${local?.illustrative?'Иллюстрация кафе · ':''}${esc(photo.credit)} · ${esc(photo.license)}</a>`:''
  return `<${cls.tag || 'span'} class="${cls.c}${photo?' has':''}" data-stop="${stop.id}"${photo?' data-done="1"':''} style="--a:${c.sky[0]};--b:${c.sky[1]}">${skyline(stop.id)}${photo?`<img class="ph" src="${esc(photo.url)}" width="960" height="640" alt="${esc(stop.name)}" loading="lazy">`:''}${inner}${cls.c.includes('walk-photo')?credit:''}</${cls.tag || 'span'}>`
}

/** Подгружает фото мест из Википедии во все элементы с data-stop */
function hydrate() {
  document.querySelectorAll('[data-stop]').forEach((el) => {
    if (el.dataset.done) return
    el.dataset.done = '1'
    const info = STOPINFO[el.dataset.stop]
    if (!info?.w) return
    loadPlace(info.w).then((p) => {
      const big = el.classList.contains('sbig')
      const pick = big ? p?.photos?.find((x) => !x.wide)?.url || p?.thumb : p?.thumb
      if (!pick || !el.isConnected) return
      if (big) {
        const tag = el.querySelector('.ptag2')
        const pano = p.photos?.some((x) => x.wide)
        const n = p.photos?.length || 0
        if (tag && (pano || n > 1)) {
          tag.textContent = pano ? `Есть панорама, ${plural(n, ['фото', 'фото', 'фото'])}` : plural(n, ['фото', 'фото', 'фото'])
          tag.hidden = false
        }
      }
      const img = new Image()
      img.alt = ''
      img.className = 'ph'
      img.referrerPolicy = 'no-referrer'
      img.onload = () => {
        if (!el.isConnected) return
        el.prepend(img)
        el.classList.add('has')
        if (el.classList.contains('walk-photo')) {
          const note = el.querySelector('.walk-photo-note')
          const photo = p.photos?.find(ph => ph.url === pick)
          if (note) note.innerHTML = `<a href="${esc(photo?.page || p.url)}" target="_blank" rel="noopener">Фото: ${esc(photo?.credit || 'Wikimedia Commons')}${photo?.license ? ', ' + esc(photo.license) : ''}</a>`
        }
      }
      img.src = pick
    })
  })
}

/* ───────────────────────── общие блоки ───────────────────────── */
function sel(id, label, value, opts) {
  return `<label class="field"><small>${label}</small><select id="${id}" name="${id}">${opts
    .map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(value) ? ' selected' : ''}>${esc(o.t)}</option>`)
    .join('')}</select></label>`
}
const HOURS = [
  { v: '1', t: 'до 1 часа' },
  { v: '2', t: '1–2 часа' },
  { v: '3', t: '2–3 часа' },
  { v: '4', t: '3–4 часа' },
  { v: '6', t: 'весь день' },
]
const nearestHours = (h) => (HOURS.find((o) => Number(o.v) >= Math.ceil(h)) || HOURS[HOURS.length - 1]).v

function legText(a, b, transport) {
  const m = dist(a, b) * 1300
  const speed = transport === 'Велосипед' ? 14 : transport === 'Авто' ? 28 : 4.8
  const min = Math.max(1, Math.round((m / 1000 / speed) * 60))
  const d = m < 1000 ? `${Math.max(50, Math.round(m / 10) * 10)} м` : `${(m / 1000).toFixed(1).replace('.', ',')} км`
  const how = transport === 'Велосипед' ? 'на велосипеде' : transport === 'Авто' ? 'на машине' : 'пешком'
  return `<b>${d}</b> ${min} мин ${how}`
}

function placeGallery(stop, variant = 'route') {
  const data = placeData(stop)
  const photos = data?.photos?.length ? data.photos : stop.photo ? [{url:stop.photo, credit:'Обложка маршрута', page:'#/credits', w:960, h:640}] : []
  if (!photos.length) return artBox({tag:'div',c:'sbig'}, stop)
  return `<div class="galwrap place-gallery ${variant}-gallery" aria-label="Фотографии: ${esc(stop.name)}">
    <div class="gallery" data-gallery tabindex="0" role="group" aria-roledescription="карусель" aria-label="Фотографии места, листайте стрелками">${photos.map((ph,i)=>`<figure class="slide${ph.wide?' wide':''}" aria-label="Фото ${i+1} из ${photos.length}">${ph.wide?`<div class="pan"><img src="${esc(ph.url)}" width="${ph.w}" height="${ph.h}" alt="Панорама: ${esc(stop.name)}" loading="lazy"></div><span class="ptag">Панорама: проведите по фото</span>`:`<img src="${esc(ph.url)}" width="${ph.w||960}" height="${ph.h||640}" alt="${esc(stop.name)} — фото ${i+1}" loading="lazy">`}<figcaption><a href="${esc(ph.page || '#/credits')}" target="_blank" rel="noopener">${data?.illustrative?'Иллюстрация кафе · ':''}${esc(ph.credit||'Источник фотографии')}${ph.license?', '+esc(ph.license):''}</a></figcaption></figure>`).join('')}</div>
    <span class="gcount" aria-live="polite">1 из ${photos.length}</span>${photos.length>1?`<button class="photo-arrow photo-prev" data-act="photo-prev" aria-label="Предыдущее фото" disabled>${I.back(19)}</button><button class="photo-arrow photo-next" data-act="photo-next" aria-label="Следующее фото">${I.back(19)}</button>`:''}
  </div>`
}
function placeHistory(stop, heading='h2') {
  const data=placeData(stop)
  if(!data?.extract) return ''
  return `<section class="inline-history wikibox"><${heading}>История и детали</${heading}><p>${esc(data.extract)}</p><a href="${esc(data.url)}" target="_blank" rel="noopener">Источник: Википедия</a><small>Текст: CC BY-SA.</small></section>`
}
function placeContent(stop, tag='h3') {
  const info=STOPINFO[stop.id]||{}
  return `<${tag} class="place-title">${esc(stop.name)}</${tag}><div class="facts big">${fact('clock',`${stop.min} мин на осмотр`)}${fact('wallet',stop.cost?`~${stop.cost} ₽`:'Бесплатно')}${stop.indoor?fact('umbrella','Под крышей'):''}${info.best?`<span class="fact">${BEST_ICON[info.best]||''} ${esc(info.best)}</span>`:''}</div><p class="desc">${esc(info.desc||stop.note)}</p>${info.tip?`<div class="tip">${I.bulb(20)}<div><b>Совет для прогулки</b><p>${esc(info.tip)}</p></div></div>`:''}${placeHistory(stop,tag==='h1'?'h2':'h4')}<a class="panorama-link" href="${links.pano(stop)}" target="_blank" rel="noopener">${I.globe(17)}Посмотреть панораму улицы</a>`
}
function updateGallery(gallery) {
  const wrap=gallery.closest('.place-gallery')
  if(!wrap) return
  const n=gallery.querySelectorAll('.slide').length
  const i=Math.max(0,Math.min(n-1,Math.round(gallery.scrollLeft/Math.max(1,gallery.clientWidth))))
  const count=wrap.querySelector('.gcount');if(count) count.textContent=`${i+1} из ${n}`
  const prev=wrap.querySelector('.photo-prev'), next=wrap.querySelector('.photo-next')
  if(prev) prev.disabled=i===0
  if(next) next.disabled=i===n-1
}
function movePhoto(gallery, delta) {
  if(!gallery) return
  const current=Math.round(gallery.scrollLeft/Math.max(1,gallery.clientWidth))
  const target=Math.max(0,Math.min(gallery.children.length-1,current+delta))
  gallery.scrollTo({left:target*gallery.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})
}
document.addEventListener('scroll', e=>{if(e.target.matches?.('[data-gallery]'))updateGallery(e.target)},true)
document.addEventListener('keydown', e=>{if(e.target.matches?.('[data-gallery]') && ['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();movePhoto(e.target,e.key==='ArrowLeft'?-1:1)}})

/** Остановки как станции на линии метро — фирменный элемент */
function lineList(stops, color, transport, swap, rich = false) {
  return `<ol class="line" style="--lc:${color}">${stops
    .map((s, i) => {
      const leg = i ? `<li class="leg"><span>${legText(stops[i - 1], s, transport)}</span></li>` : ''
      const has = STOPINFO[s.id]?.w
      const inf = STOPINFO[s.id] || {}
      if (rich) return leg + `<li class="stn rich"><span class="dot">${i+1}</span><div class="sbody route-place-detail">${placeGallery(s)}<div class="route-place-copy">${placeContent(s)}${swap?`<button class="btn ghost block" data-act="swap" data-i="${i}">${I.swap(16)}Заменить остановку</button>`:''}</div></div></li>`

      return (
        leg +
        `<li class="stn"><span class="dot">${i + 1}</span>
          <div class="sbody">
            <h3><a href="#/s/${esc(s.id)}">${esc(s.name)}</a></h3>
            <p class="smeta"><span>${s.min} мин</span><span>${s.cost ? '~' + s.cost + ' ₽' : 'Бесплатно'}</span>${s.indoor ? '<span class="in">под крышей</span>' : ''}</p>
            <p class="note">${esc(s.note)}</p>
            <a class="more" href="#/s/${esc(s.id)}">Фото и описание</a>
          </div>
          ${has ? `<a href="#/s/${esc(s.id)}" tabindex="-1" aria-hidden="true">${artBox({ c: 'sthumb' }, s)}</a>` : ''}
          ${swap ? `<button class="swap" data-act="swap" data-i="${i}" aria-label="Заменить «${esc(s.name)}»">${I.swap(16)}<span>Заменить</span></button>` : ''}
        </li>`
      )
    })
    .join('')}</ol>`
}

const crumb = (label = 'Назад') => `<div class="crumb"><button class="back" data-act="back">${I.back(18)}${label}</button></div>`
const stats = (r) =>
  `<div class="stats"><div><b>${fmtH(r.hours)}</b><span>время</span></div><div><b>${fmtKm(r.km)}</b><span>длина</span></div><div><b>${fmtCost(r.cost)}</b><span>стоимость</span></div></div>`

const WALK_KEY = 'geovibe:walk:v1'
function saveWalk() {
  try { localStorage.setItem(WALK_KEY, JSON.stringify(ctx.walk)) } catch { /* Private mode. */ }
}
function restoreWalk() {
  try {
    const w = JSON.parse(localStorage.getItem(WALK_KEY) || 'null')
    if (!w?.route?.stops?.length || !Number.isInteger(w.index) || w.index < 0 || w.index >= w.route.stops.length) return null
    return w
  } catch { return null }
}
ctx.walk = restoreWalk()
let activeMap

function startWalk(route) {
  if (!ctx.walk || ctx.walk.finished || ctx.walk.route.id !== route.id || ctx.walk.route.stops.map(s=>s.id).join() !== route.stops.map(s=>s.id).join()) ctx.walk = {route, index: 0, finished: false}
  saveWalk()
  nav('#/walk')
}

function walkView() {
  const w = ctx.walk
  if (!w) return {title:'Прогулка', html:`<div class="page narrow"><div class="empty"><h1>Выберите прогулку</h1><p>Откройте маршрут и нажмите «Начать маршрут».</p><a class="btn ink" href="#/">Найти маршрут</a></div></div>`}
  const r=w.route, index=w.index, stop=r.stops[index], info=STOPINFO[stop.id] || {}, final=index===r.stops.length-1
  if(w.finished) return {title:'Прогулка завершена', html:`<div class="page narrow walk-complete"><span class="empty-heart">${I.check(40)}</span><h1>Ещё одна хорошая прогулка</h1><p>Вы завершили маршрут «${esc(r.title)}» и отметили ${plural(r.stops.length,['остановку','остановки','остановок'])}.</p><button class="btn ink block" data-act="walk-review">Оценить прогулку</button><button class="btn ghost block" data-act="walk-restart">Пройти ещё раз</button><a class="btn ghost block" href="#/">Найти следующий маршрут</a></div>`}
  return {
    title: `${stop.name} — прогулка`,
    after: () => {
      return drawMap($('#walk-map'),r.stops,lineColor(r.city),{
        activeIndex:index, autoLocate:true,
        onStatus: text=>{const el=$('#walk-location-status');if(el) el.textContent=text},
        onLocation: pos=>{
          const el=$('#walk-distance');if(el) el.textContent=pos.km<.06?'Вы рядом':`${pos.km<1?Math.round(pos.km*1000)+' м':pos.km.toFixed(1).replace('.',',')+' км'} по прямой`
          const external=$('#walk-external');if(external) external.href=`https://yandex.ru/maps/?rtext=${pos.lat}%2C${pos.lng}~${stop.lat}%2C${stop.lng}&rtt=pd`
        },
      })
    },
    html:`<div class="page walkpage" style="--lc:${lineColor(r.city)}">
      <header class="walk-header"><a class="back" href="#/plan" data-act="walk-overview">${I.back(18)}Весь маршрут</a><span>Остановка ${index+1} из ${r.stops.length}</span></header>
      <div class="walk-progress" role="group" aria-label="Остановки маршрута">${r.stops.map((st,i)=>`<button data-act="walk-jump" data-i="${i}" class="${i===index?'current':i<index?'visited':''}" aria-label="Остановка ${i+1}: ${esc(st.name)}"${i===index?' aria-current="step"':''}><span>${i<index?I.check(12):i+1}</span></button>`).join('')}</div>
      <div class="walk-layout"><article class="walk-place">
        ${placeGallery(stop,'walk')}
        <div class="walk-copy"><p class="walk-city">${esc(r.city)} / ${esc(r.title)}</p>${placeContent(stop,'h1')}</div>
      </article><aside class="walk-directions"><div class="walk-map-heading"><div><h2>К текущей остановке</h2><p id="walk-distance">Разрешите геолокацию, чтобы увидеть расстояние</p></div><button class="iconbtn" data-act="walk-locate" aria-label="Показать моё местоположение">${I.nav(20)}</button></div><div class="mapbox" id="walk-map"></div><p class="walk-map-legend"><span class="gps-key"></span>Вы здесь<span class="destination-key"></span>Остановка ${index+1}</p><p class="walk-location-status" id="walk-location-status" role="status">Определяем ваше местоположение…</p><a class="btn ghost block" id="walk-external" href="${links.route(stop)}" target="_blank" rel="noopener">Путь в Яндекс.Картах ${I.nav(16)}</a><a class="panorama-link" href="${links.pano(stop)}" target="_blank" rel="noopener">${I.globe(16)}Панорама этой остановки в Яндекс.Картах</a><p class="walk-geo-note">Геолокация используется для пути к остановке, пока открыт этот экран. Позиция не сохраняется.</p></aside></div>
      <footer class="walk-controls"><button class="btn ghost" data-act="walk-prev" ${index===0?'disabled':''}>${I.back(17)}Назад</button><div><span>Сейчас</span><b>${esc(stop.name)}</b></div><button class="btn ink" data-act="walk-next">${final?'Завершить прогулку':'Следующая остановка'}${I.check(17)}</button></footer>
    </div>`,
  }
}

/* ───────────────────────── экраны ───────────────────────── */
function card(r, feature) {
  const fav = isFav(r.id)
  return `<article class="card" style="--lc:${lineColor(r.city)}">
    <a class="card-photo" href="#/r/${esc(r.id)}" aria-label="Открыть маршрут: ${esc(r.title)}">${cover(r, `<span class="stamp">${I.pin(13)}${esc(r.city)}</span>${r.cost === 0 ? '<span class="free">Бесплатно</span>' : ''}`)}</a>
    <button class="favbtn${fav ? ' on' : ''}" data-act="fav-card" data-id="${esc(r.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Убрать из избранного' : 'Сохранить в избранное'}">${I.heart(19, fav)}</button>
    <div class="cbody"><h3><a href="#/r/${esc(r.id)}">${esc(r.title)}</a></h3>
      <div class="facts">${fact('clock', fmtH(r.hours))}${fact('walk', r.transport)}${fact('pin', fmtKm(r.km))}</div>
      <div class="by"><i class="ava">${first(r.handle)}</i><span>${esc(r.handle)}</span>${r.rating ? `<span class="rate">${I.star(14)}${r.rating.toFixed(1)}</span>` : ''}</div>
    </div></article>`
}

function filtered() {
  const q = F.q.trim().toLowerCase()
  return all()
    .filter((r) => F.city === 'all' || r.city === F.city)
    .filter((r) => F.tr === 'all' || r.transport === F.tr)
    .filter((r) => (!F.tag ? true : F.tag === 'free' ? r.cost === 0 : F.tag === 'indoor' ? r.stops.filter((s) => s.indoor).length / r.stops.length >= 0.5 : r.tags.includes(F.tag)))
    .filter((r) => (F.time === 'all' ? true : F.time === 's' ? r.hours <= 2 : F.time === 'm' ? r.hours > 2 && r.hours <= 3 : r.hours > 3))
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.tags.some((t) => t.includes(q)) ||
        r.stops.some((s) => s.name.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.likes - a.likes)
}
function gridHtml() {
  const list = filtered()
  if (!list.length)
    return `<div class="empty"><h3>Ничего не нашлось</h3><p>Смените фильтры или попросите «Гоу?» собрать маршрут сами.</p><a class="btn ink" href="#/go">Открыть «Гоу?»</a></div>`
  return list.map((r, i) => card(r, i === 0 && list.length >= 3 && !F.q)).join('')
}

const TAGS = [
  ['', 'Все подборки'], ['закат', 'Закат'], ['романтика', 'Романтика'], ['кофе', 'Кофе'], ['виды', 'Виды'], ['дети', 'С детьми'],
  ['гастро', 'Еда'], ['природа', 'Природа'], ['музеи', 'Музеи'], ['актив', 'Актив'], ['free', 'Бесплатно'], ['indoor', 'Под крышей'],
]
const QUICK = [
  ['Закат у воды', 'Закат у воды, красивые виды, 2 часа'],
  ['Под крышей', 'В дождь, музеи и тёплые кафе, 3 часа'],
  ['С детьми', 'Прогулка с детьми, 3 часа'],
  ['Недорого', 'Недорогая прогулка, бюджет до 1000₽'],
]

function feed() {
  const city = F.city !== 'all' ? F.city : 'Москва'
  const w = weatherFor(city, false)
  const featured = city === 'Москва' ? EXAMPLE : CATALOG.find((r) => r.city === city)
  const chip = (v, t) => `<button class="chip${F.city === v ? ' on' : ''}" aria-pressed="${F.city === v}" data-act="city" data-v="${esc(v)}">${v === 'all' ? '' : `<i style="background:${lineColor(v)}"></i>`}${esc(t)}</button>`
  const tag = ([v, t]) => `<button class="chip soft${v === '' ? ' all' : ''}${F.tag === v ? ' on' : ''}" aria-pressed="${F.tag === v}" data-act="tag" data-v="${esc(v)}">${esc(t)}</button>`
  return {
    title: 'Маршруты',
    html: `<div class="page feedpage">
      <section class="today">
        <div class="today-text">
          <p class="wxline">${I.pin(15)}${esc(city)}<span class="weather-note">${esc(w.temp)} ${esc(w.text.toLowerCase())}<small>демо</small></span></p>
          <h1>Куда пойдём <br>сегодня?</h1>
          <p class="today-lead">Выйти за привычный маршрут.<br>Найти своё место. Просто хорошо провести день.</p>
          <form class="ask" data-form="ask">
            <label class="sr" for="ask-in">Как хотите погулять</label>
            ${I.search(20)}<input id="ask-in" name="query" placeholder="Кофе, набережная, пара часов…" autocomplete="off">
            <button class="btn coral" type="submit">Гоу? ${I.send(17)}</button>
          </form>
          <div class="quick">${QUICK.map(([l, q], i) => `<button data-act="say-go" data-v="${esc(q)}">${[I.sun(15), I.umbrella(15), I.walk(15), I.wallet(15)][i]}${esc(l)}</button>`).join('')}</div>
          <p class="today-hint">${I.check(14)}Без регистрации. С остановками, временем и деталями.</p>
        </div>
        <div class="today-art">
          <img class="today-photo" src="${esc(city === 'Москва' ? 'assets/photos/moscow.jpg' : featured.photo)}" width="1000" height="1100" alt="${esc(city === 'Москва' ? 'Храм Василия Блаженного в Москве' : featured.title)}" fetchpriority="high">
          <span class="photo-label">${I.pin(15)}${esc(city === 'Москва' ? 'Откройте Москву заново' : city)}</span>
          <a class="hero-route" href="#/r/${esc(featured.id)}"><span class="hero-route-kicker">Идея для вашей прогулки</span><h2>${city === 'Москва' ? 'Вдоль реки, <br>навстречу городу' : esc(featured.title)}</h2><div class="hero-route-meta"><span>${I.clock(16)}${fmtH(featured.hours)}</span><span>${I.pin(16)}${plural(featured.stops.length, ['остановка', 'остановки', 'остановок'])}</span><span class="hero-route-open">${I.back(18)}</span></div><svg class="mini-trail" viewBox="0 0 300 20" aria-hidden="true"><path d="M8 10H292"/><circle cx="8" cy="10" r="4"/><circle cx="100" cy="10" r="4"/><circle cx="200" cy="10" r="4"/><circle cx="292" cy="10" r="4"/></svg></a>
        </div>
      </section>
      ${ctx.walk && !ctx.walk.finished ? `<a class="resume-walk" href="#/walk"><span class="resume-icon">${I.walk(24)}</span><span><b>Продолжить прогулку</b><small>${esc(ctx.walk.route.stops[ctx.walk.index].name)} · остановка ${ctx.walk.index+1} из ${ctx.walk.route.stops.length}</small></span>${I.nav(20)}</a>` : ''}
      <header class="pagehead sec"><div><h2 class="sech">Маленькое путешествие рядом</h2><p class="lead">Маршруты от тех, кто знает город</p></div><a href="#/go" class="catalog-cta">Подобрать для меня ${I.search(16)}</a></header>
      <div class="filters">
        <div class="chips" role="group" aria-label="Город">${chip('all', 'Все города')}${CITIES.map((c) => chip(c, c)).join('')}</div>
        <div class="chips" role="group" aria-label="Подборки">${TAGS.map(tag).join('')}</div>
        <div class="selects">
          ${sel('f-tr', 'Способ передвижения', F.tr, [{ v: 'all', t: 'Любой' }, ...TRANSPORTS.map((t) => ({ v: t, t }))])}
          ${sel('f-time', 'Время прогулки', F.time, [{ v: 'all', t: 'Любое' }, { v: 's', t: 'до 2 часов' }, { v: 'm', t: '2–3 часа' }, { v: 'l', t: 'от 3 часов' }])}
          <label class="field search"><small>Поиск</small><input id="f-q" name="search" autocomplete="off" type="search" placeholder="Место или тема" value="${esc(F.q)}"></label>
        </div>
      </div>
      <div id="grid" class="grid">${gridHtml()}</div>
    </div>`,
  }
}

function routeDetail(id) {
  const r = all().find((x) => x.id === id)
  if (!r) return notFound()
  const col = lineColor(r.city)
  const fol = S.follows.includes(r.handle)
  return {
    title: r.title,
    after: () => drawMap($('#map'), r.stops, col),
    html: `<div class="page detail" style="--lc:${col}">
      ${crumb('Все маршруты')}
      <div class="dgrid">
        <div class="dmain">
          ${cover(r, `<div class="badge">${likeBadge(r.likes)}</div>`, 'hero')}
          <h1>${esc(r.title)}</h1>
          <div class="facts big">${lineBadge(r.city)}${fact('walk', r.transport)}${fact('clock', fmtH(r.hours))}${r.rating ? `<span class="fact star">${I.star(15)}${r.rating.toFixed(1)} <em>(${r.reviews})</em></span>` : ''}</div>
          <div class="route-actions"><button class="btn ink" data-act="walk-start" data-id="${esc(r.id)}">${I.walk(18)}${ctx.walk?.route.id===r.id&&!ctx.walk.finished?'Продолжить прогулку':'Начать маршрут'}</button><button class="iconbtn" data-act="fav-route" data-id="${esc(r.id)}" aria-label="${isFav(r.id)?'Убрать из избранного':'Сохранить в избранное'}" aria-pressed="${isFav(r.id)}">${I.heart(20,isFav(r.id))}</button></div>
          <div class="authorrow">
            <i class="ava lg">${first(r.author)}</i>
            <div><b>${esc(r.handle)}</b><small>автор маршрута</small></div>
            <button class="btn ghost" data-act="follow" data-h="${esc(r.handle)}">${fol ? 'Вы подписаны' : 'Подписаться'}</button>
            <button class="iconbtn" data-act="share" aria-label="Поделиться маршрутом">${I.share(18)}</button>
          </div>
          <p class="desc">${esc(r.desc)}</p>
          ${stats(r)}
          ${photoStrip(r.stops)}
          <h2>Что внутри</h2>
          ${lineList(r.stops, col, r.transport, false, true)}
        </div>
        <aside class="dside">
          <div class="panel sticky">
            <h2>Прогулка на карте</h2>
            <p class="map-help">Нажимайте на места: внутри фото, описание и панорамы улиц.</p>
            <div class="mapbox" id="map"></div>
          </div>
        </aside>
      </div>
    </div>`,
  }
}

const EXAMPLE = CATALOG.find((r) => r.id === 'msk-zaryadye')
const POPULAR = [
  ['Романтический маршрут на закате', 'Романтический маршрут на закате в Москве, 2 часа, красивые виды'],
  ['С детьми', 'Прогулка с детьми в Москве на 3 часа'],
  ['Гастрономический маршрут', 'Гастрономический маршрут в Санкт-Петербурге, уютные кафе'],
  ['Активный, на велосипеде', 'Активный маршрут на велосипеде по Москве, виды на реку'],
  ['В дождь', 'Что делать в Москве в дождь: музеи и тёплые кафе, 3 часа'],
  ['До 1000 ₽', 'Недорогая прогулка по Казани, бюджет до 1000₽'],
  ['За город, на машине', 'Поездка на машине в небольшой город: Коломна, пастила и виды'],
]
const SAMPLE = 'Хочу прогулку по Москве, на 2–3 часа, на метро и пешком, с красивыми видами и уютными кафе. Бюджет до 1500₽. Желательно без дождя!'

const CHAT_EXAMPLES = [
  ['Пешком по Питеру', 'Хочу пойти погулять пешком в Питере на 3–5 часов'],
  ['Москва в дождь', 'В Москве в дождь, пешком, на 2–3 часа, бюджет до 1500 рублей'],
  ['Казань бесплатно', 'Пешком по Казани на 2 часа бесплатно'],
  ['На велосипеде', 'По Москве на велосипеде на 3 часа, бюджет до 1000 рублей'],
]
const WEATHER_LABEL = {rain:'В дождь',snow:'В снег',cold:'В холод',hot:'В жару',dry:'Без дождя'}
function queryChips(q) {
  const time=q.hoursGiven ? q.hoursMin>0?`${q.hoursMin}–${q.hoursMax} ч`: `До ${fmtH(q.hoursMax ?? q.hours)}` : ''
  return [q.city,q.transport,time,q.budget!==undefined?(q.budget===0?'Бесплатно':`До ${q.budget.toLocaleString('ru-RU')} ₽`):'',WEATHER_LABEL[q.weather],...q.tags].filter(Boolean)
}
function chatHtml() {
  const welcome=`<div class="bubble bot welcome"><b>Как хотите погулять?</b><p>Напишите город, время, бюджет и способ передвижения. Например: «Пешком по Питеру на 3–5 часов, до 1000 рублей».</p><div class="chat-options">${CHAT_EXAMPLES.map(([label,text])=>`<button data-act="say" data-v="${esc(text)}"${ctx.busy?' disabled':''}>${esc(label)}</button>`).join('')}</div></div>`
  return welcome + ctx.chat.map((m,i)=>{
    const result=m.result
    return `<article class="bubble ${m.role}" aria-label="${m.role==='me'?'Ваше сообщение':'Ответ GeoVibe'}"><p>${esc(m.text)}</p>${m.chips?`<div class="chat-options">${m.chips.map(city=>`<button data-act="say" data-v="${esc(city)}"${ctx.busy?' disabled':''}>${esc(city)}</button>`).join('')}</div>`:''}${m.query?`<div class="query-chips" aria-label="Распознанные условия">${queryChips(m.query).map(text=>`<span>${esc(text)}</span>`).join('')}</div>`:''}${result?`<section class="chat-route">${cover(result.route)}<div><h2>${esc(result.route.title)}</h2><div class="facts">${fact('pin',result.route.city)}${fact('walk',result.route.transport)}${fact('clock',`~${fmtH(result.route.hours)}`)}${fact('wallet',fmtCost(result.route.cost))}</div><p class="chat-stops">${result.route.stops.map(s=>esc(s.name)).join(' → ')}</p><button class="btn ink" data-act="chat-start" data-i="${i}">Начать маршрут</button><button class="btn ghost" data-act="chat-details" data-i="${i}">Подробнее</button></div></section>`:''}</article>`
  }).join('') + (ctx.busy?'<div class="bubble bot typing" role="status" aria-label="Подбираем маршрут"><span></span><span></span><span></span></div>':'')
}
function goView() {
  return {
    title:'Гоу? Подбор маршрута',
    after:()=>{
      syncChatViewport()
      refreshChat()
      if(ctx.prefill){const text=ctx.prefill;ctx.prefill='';say(text)}
    },
    html:`<div class="page chat-page"><section class="chat-shell" aria-label="Подбор прогулки">
      <header class="chat-heading"><div><h1>Гоу?</h1><p>Соберём прогулку под ваши планы</p></div><button class="iconbtn" data-act="chat-reset" aria-label="Начать новый диалог">${I.plus(19)}</button></header>
      <div id="chat-thread" class="chat-thread" role="log" aria-label="Переписка с GeoVibe" aria-live="polite" aria-relevant="additions text">${chatHtml()}</div>
      <form class="chat-composer" data-form="go"><label class="sr" for="go-in">Сообщение для подбора маршрута</label><textarea id="go-in" name="query" rows="2" autocomplete="off" placeholder="Город, время, бюджет…">${esc(ctx.chatDraft)}</textarea><button class="chat-send" type="submit" aria-label="Отправить сообщение"${ctx.busy?' disabled':''}>${I.send(20)}</button><small>Enter — отправить, Shift+Enter — новая строка. Цены и погода примерные.</small></form>
    </section></div>`,
  }
}
function say(raw) {
  const text=String(raw||'').trim()
  if(!text || ctx.busy)return
  ctx.chat=ctx.chat.map(m=>({...m,chips:undefined}))
  ctx.chat.push({role:'me',text})
  ctx.chatQuery=mergeQuery(ctx.chatQuery,parseQuery(text))
  const q=ctx.chatQuery
  ctx.chatDraft=''
  const input=$('#go-in');if(input)input.value=''
  if(!q.city){ctx.chat.push({role:'bot',text:'В каком городе гуляем? Время, бюджет и остальные пожелания я сохранил.',chips:CITIES});refreshChat();return}
  ctx.busy=true;refreshChat()
  ctx.chatJob=setTimeout(()=>{
    ctx.busy=false;ctx.chatJob=null
    try {
      const result=generate(q,all())
      if(!result)ctx.chat.push({role:'bot',text:'Не удалось собрать маршрут по всем условиям. Попробуйте увеличить время или бюджет, либо выберите другой город.',query:q})
      else {ctx.result=result;ctx.chat.push({role:'bot',text:'Подобрал прогулку. Можно начать маршрут или уточнить условия.',query:q,result})}
    } catch {ctx.chat.push({role:'bot',text:'Не получилось подобрать прогулку. Попробуйте ещё раз с городом, временем и бюджетом.'})}
    refreshChat()
  },350)
}
function refreshChat() {
  const thread=$('#chat-thread')
  if(!thread)return
  thread.innerHTML=chatHtml()
  thread.scrollTop=thread.scrollHeight
  const send=$('.chat-send');if(send)send.disabled=ctx.busy
}

function resultView() {
  const g = ctx.result
  if (!g) return redirect('#/go')
  const { route: r, weather: w, reasons, q } = g
  const col = lineColor(r.city)
  return {
    title: 'Ваш маршрут готов',
    html: `<div class="page detail" style="--lc:${col}">
      ${crumb('Назад')}
      <header class="pagehead"><h1>Ваш маршрут готов ${'<span class="spk sm">' + I.spark(26) + '</span>'}</h1><p class="lead">Мы учли погоду, стоимость и выбрали самые залайканные места.</p></header>
      <div class="dgrid">
        <div class="dmain">
          <div class="infobar">
            <div><span class="wx">${w.icon}</span><span><b>${esc(w.temp)}</b><small>${esc(w.text)}</small></span></div>
            <div><span class="wx">${I.wallet(26)}</span><span><b>${fmtCost(r.cost)}</b><small>Примерная стоимость</small></span></div>
            <div><span class="wx">${I.clock(26)}</span><span><b>${fmtH(r.hours)}</b><small>В пути ${fmtKm(r.km)}</small></span></div>
          </div>
          ${cover(r, `<div class="badge">${likeBadge(r.likes)}</div>`, 'hero short')}
          <h2 class="rname">${esc(r.title)}</h2>
          <div class="facts big">${lineBadge(r.city)}${fact('walk', r.transport)}${fact('clock', fmtH(r.hours))}</div>
          <p class="desc">${esc(r.desc)}</p>
          <ol class="hline" style="--lc:${col}" aria-label="Остановки">${r.stops.map((s, i) => `<li><span class="dot">${i + 1}</span><span class="hn">${esc(s.name)}</span></li>`).join('')}</ol>
          <div class="actions">
            <button class="btn ink" data-act="walk-start" data-source="result">Начать маршрут</button>
            <button class="btn ghost" data-act="another">Показать другой вариант</button>
          </div>
        </div>
        <aside class="dside">
          <div class="panel">
            <h2>Почему этот маршрут?</h2>
            <ul class="reasons">${reasons.map((x) => `<li><span class="ri">${I.check(16)}</span>${esc(x.text)}</li>`).join('')}</ul>
            <p class="req">Ваш запрос: «${esc(q.text.length > 140 ? q.text.slice(0, 138) + '…' : q.text)}»</p>
          </div>
        </aside>
      </div>
    </div>`,
  }
}

function planView() {
  const p = ctx.plan
  if (!p) return redirect('#/go')
  const r = p.route
  const col = lineColor(r.city)
  const m = meta(r.stops)
  const done = S.done.some((d) => d.id === r.id)
  const fav = isFav(r.id)
  const rate = done
    ? `<p class="okline">${I.check(18)}Маршрут пройден и оценён</p>`
    : ctx.rateOpen
      ? `<div class="ratebox"><b>Как прошла прогулка?</b><div class="stars" role="group" aria-label="Оценка">${[1, 2, 3, 4, 5].map((i) => `<button data-act="star" data-v="${i}" class="${i <= ctx.rating ? 'on' : ''}" aria-label="${i} из 5">${i <= ctx.rating ? I.star(30) : I.starO(30)}</button>`).join('')}</div><button class="btn ink block" data-act="rate-send"${ctx.rating ? '' : ' disabled'}>Отправить оценку</button></div>`
      : `<button class="btn ghost block" data-act="rate-open">Я прошёл этот маршрут</button>`
  return {
    title: r.title,
    after: () => drawMap($('#map'), r.stops, col),
    html: `<div class="page detail plan" style="--lc:${col}">
      ${crumb('Назад')}
      <header class="pagehead tight"><h1>${esc(r.title)}</h1>
        <div class="facts big">${lineBadge(r.city)}${fact('clock', fmtH(m.hours))}${fact('pin', fmtKm(m.km))}${fact('wallet', fmtCost(m.cost))}</div></header>
      <div class="dgrid">
        <div class="dmain">
          <button class="rain${p.rain ? ' on' : ''}" data-act="rain">${I.umbrella(18)}${p.rain ? 'Дождь: подобраны места под крышей' : 'Пошёл дождь? Перестроим маршрут под крышу'}</button>
          ${lineList(r.stops, col, r.transport, true, true)}
        </div>
        <aside class="dside"><div class="panel sticky">
          <button class="btn ink block walk-start-plan" data-act="walk-start">${I.walk(18)}${ctx.walk?.route.id===r.id&&!ctx.walk.finished?'Продолжить прогулку':'Начать маршрут'}</button>
          <div class="mapbox tall" id="map"></div>
          <button class="btn ${fav ? 'coral' : 'ink'} block" data-act="fav-plan">${I.heart(18, fav)}${fav ? 'В избранном' : 'Сохранить в избранное'}</button>
          ${rate}
        </div></aside>
      </div>
    </div>`,
  }
}

function favsView() {
  const demo = !S.favs.length
  const base = S.favs
  const cities = [...new Set(base.map((r) => r.city))]
  if (ctx.favCity !== 'all' && !cities.includes(ctx.favCity)) ctx.favCity = 'all'
  const list = base.filter((r) => ctx.favCity === 'all' || r.city === ctx.favCity)
  const chip = (v, t) => `<button class="chip${ctx.favCity === v ? ' on' : ''}" data-act="fav-city" data-v="${esc(v)}">${v === 'all' ? '' : `<i style="background:${lineColor(v)}"></i>`}${esc(t)}</button>`
  return {
    title: 'Избранное',
    html: `<div class="page">
      <header class="pagehead"><h1>Избранное</h1>${demo ? '<p class="lead">Сохраняйте интересные маршруты — они будут ждать вас здесь.</p>' : ''}</header>
      <div class="filters"><div class="chips">${chip('all', 'Все')}${cities.map((c) => chip(c, c)).join('')}</div></div>
      <div class="grid compact">${demo ? `<div class="empty"><span class="empty-heart">${I.heart(36)}</span><h3>Планы на хороший день</h3><p>Нажмите на сердечко у понравившегося маршрута,<br>чтобы вернуться к нему перед прогулкой.</p><a class="btn coral" href="#/">Найти маршрут</a></div>` : ""}${list
        .map((r) => {
          const href = '#/fav/' + esc(r.id)
          return `<a class="card" href="${href}" style="--lc:${lineColor(r.city)}">${cover(r, `<div class="badge">${likeBadge(r.likes)}</div>`)}<div class="cbody"><h3>${esc(r.title)}</h3><div class="facts">${lineBadge(r.city)}${fact('clock', fmtH(r.hours))}</div></div></a>`
        })
        .join('')}</div>
    </div>`,
  }
}

let deferredInstall

function profileView() {
  const mine = all().filter((r) => r.own)
  const likes = mine.reduce((n, r) => n + r.likes, 0)
  const avg = S.done.length ? (S.done.reduce((n, d) => n + d.rating, 0) / S.done.length).toFixed(1).replace('.', ',') : '4,8'
  const t = ctx.profileTab
  const rows =
    t === 'mine'
      ? mine
          .map(
            (r) => `<li><a href="#/r/${esc(r.id)}" style="--lc:${lineColor(r.city)}">${cover(r, '', 'thumb')}<div><b>${esc(r.title.replace(/^Мой маршрут: /, ''))}</b><small>${esc(r.city)}, ${fmtH(r.hours)}</small></div><span class="lk">${I.heart(13, true)}${r.likes}</span></a></li>`,
          )
          .join('')
      : S.done.length
        ? S.done.map((d) => `<li><div class="donerow"><span class="ok">${I.check(16)}</span><div><b>${esc(d.title)}</b><small>${esc(d.city)}, ${new Date(d.at).toLocaleDateString('ru-RU')}</small></div><span class="lk">${I.star(13)}${d.rating}</span></div></li>`).join('')
        : `<li class="empty-li">Пройденных маршрутов пока нет. Откройте любой маршрут и нажмите «Я прошёл этот маршрут».</li>`
  const ios = isIOS() && !standalone()
  return {
    title: 'Профиль',
    html: `<div class="page"><div class="profgrid">
      <section>
        <div class="phead"><img class="profile-photo profile-photo-large" src="assets/people/anna.jpg" width="88" height="88" alt="Анна — демонстрационный профиль"><div><h1>Анна Петрова</h1><span class="handle">@anna_travel</span></div></div>
        <div class="pstats"><div><b>${mine.length}</b><span>маршрутов</span></div><div><b>${S.done.length}</b><span>пройдено</span></div><div><b>${avg}</b><span>рейтинг</span></div><div><b>${likes}</b><span>лайков</span></div></div>
        <p class="bio">Люблю новые города, вкусную еду и красивые закаты. Делюсь маршрутами, которые действительно понравились.</p>
        ${passportHtml()}
        <div class="tabs2" role="group" aria-label="Ваши маршруты"><button aria-pressed="${t === 'mine'}" class="${t === 'mine' ? 'on' : ''}" data-act="ptab" data-v="mine">Мои маршруты</button><button aria-pressed="${t === 'done'}" class="${t === 'done' ? 'on' : ''}" data-act="ptab" data-v="done">Пройденные</button></div>
        <ul class="rows">${rows}</ul>
        <a class="btn ink block" href="#/new">${I.plus(18)}Создать маршрут</a>
      </section>
      <aside class="panel instpanel">
        <h2>Приложение на телефоне и компьютере</h2>
        <p>GeoVibe работает как обычное приложение: открывается с главного экрана, без адресной строки, и показывает уже загруженные маршруты без интернета.</p>
        ${
          standalone()
            ? `<p class="okline">${I.check(18)}Приложение уже установлено</p>`
            : ios
              ? `<button class="btn ink block" data-install="open">${I.download(18)}Добавить на экран «Домой»</button><p class="hint">Покажем, где найти команду установки в Safari.</p>`
              : `<button class="btn coral block" data-act="install" id="install-prof"${deferredInstall ? '' : ' hidden'}>${I.download(18)}Установить приложение</button>
                 <p class="hint" id="install-hint"${deferredInstall ? ' hidden' : ''}>В Chrome и Edge нажмите значок установки в адресной строке. На Android: меню, затем «Добавить на главный экран».</p>`
        }
        <a class="btn ghost block" href="#/brand">Дизайн-система GeoVibe</a>
        <button class="btn ghost block danger" data-act="reset">Сбросить данные демо</button>
      </aside>
    </div></div>`,
  }
}

function createView() {
  const c = ctx.create
  const pool = STOP_POOL.filter((s) => s.city === c.city)
  return {
    title: 'Новый маршрут',
    html: `<div class="page narrow">
      ${crumb('Назад')}
      <header class="pagehead tight"><h1>Новый маршрут</h1><p class="lead">Соберите прогулку из мест, которые уже есть в каталоге.</p></header>
      <label class="field"><small>Название</small><input id="c-title" name="title" autocomplete="off" value="${esc(c.title)}" maxlength="80" placeholder="Например, «Вечер на набережной»"></label>
      <label class="field"><small>Описание</small><textarea id="c-desc" name="description" autocomplete="off" rows="3" maxlength="300" placeholder="Что здесь стоит увидеть">${esc(c.desc)}</textarea></label>
      <div class="two">${sel('c-city', 'Город', c.city, CITIES.map((x) => ({ v: x, t: x })))}${sel('c-tr', 'Способ передвижения', c.tr, TRANSPORTS.map((x) => ({ v: x, t: x })))}</div>
      <h2>Точки по порядку <span class="cnt">${c.picked.length}</span></h2>
      <ul class="pick">${pool
        .map((s) => {
          const i = c.picked.indexOf(s.id)
          return `<li><button class="${i >= 0 ? 'on' : ''}" data-act="pick" data-id="${esc(s.id)}"><span class="pn">${i >= 0 ? i + 1 : ''}</span><span><b>${esc(s.name)}</b><small>${s.min} мин, ${s.cost ? '~' + s.cost + ' ₽' : 'бесплатно'}</small></span></button></li>`
        })
        .join('')}</ul>
      <button class="btn ink block" data-act="publish">Опубликовать</button>
    </div>`,
  }
}

function photoStrip(stops) {
  const list = stops.filter((s) => STOPINFO[s.id]?.w)
  if (!list.length) return ''
  return `<h2>Места на фото</h2><div class="strip">${list.map((s) => `<a class="shot-wrap" href="#/s/${esc(s.id)}">${artBox({ c: 'shot' }, s, `<span class="cap">${esc(s.name)}</span>`)}</a>`).join('')}</div>`
}

const links = {
  pano: (s) => `https://yandex.ru/maps/?ll=${s.lng}%2C${s.lat}&z=17&l=stv%2Csta&panorama%5Bpoint%5D=${s.lng}%2C${s.lat}&panorama%5Bdirection%5D=0%2C0&panorama%5Bspan%5D=130%2C70`,
  route: (s) => `https://yandex.ru/maps/?rtext=~${s.lat}%2C${s.lng}&rtt=pd`,
  google: (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking`,
}

function stopView(id) {
  const s = STOP_POOL.find((x) => x.id === id)
  if (!s) return notFound()
  const info = STOPINFO[id] || { w: null, desc: s.note, tip: '', best: '' }
  const col = lineColor(s.city)
  const near = STOP_POOL.filter((x) => x.id !== s.id && x.city === s.city).sort((a, b) => dist(a, s) - dist(b, s)).slice(0, 4)
  const inRoutes = all().filter((r) => r.stops.some((x) => x.id === s.id))
  const c = CITY[s.city] || CITY['Москва']
  return {
    title: s.name,
    after: () => {
      const map = drawMap($('#map'), [s], col)
      return map
    },
    html: `<div class="page detail" style="--lc:${col}">
      ${crumb('Назад')}
      <div class="dgrid">
        <div class="dmain">
          ${placeGallery(s,'standalone')}
          <h1>${esc(s.name)}</h1>
          <div class="facts big">${lineBadge(s.city)}${fact('clock', `${s.min} мин`)}${fact('wallet', s.cost ? `~${s.cost} ₽` : 'Бесплатно')}${s.indoor ? `<span class="fact in">${I.umbrella(15)}под крышей</span>` : ''}${info.best ? `<span class="fact">${BEST_ICON[info.best] || ''} лучше всего: ${esc(info.best)}</span>` : ''}</div>
          <p class="desc">${esc(info.desc)}</p>
          ${info.tip ? `<div class="tip">${I.bulb(20)}<div><b>Совет</b><p>${esc(info.tip)}</p></div></div>` : ''}
          ${placeHistory(s)}
          ${inRoutes.length ? `<h2>Это место есть в маршрутах</h2><ul class="rows">${inRoutes.map((r) => `<li><a href="#/r/${esc(r.id)}">${cover(r, '', 'thumb')}<div><b>${esc(r.title.replace(/^Мой маршрут: /, ''))}</b><small>${esc(r.city)}, ${fmtH(r.hours)}</small></div><span class="lk">${I.heart(13, true)}${r.likes}</span></a></li>`).join('')}</ul>` : ''}
          ${near.length ? `<h2>Рядом, в городе ${esc(s.city)}</h2><div class="strip">${near.map((n) => `<a class="shot-wrap" href="#/s/${esc(n.id)}">${artBox({ c: 'shot' }, n, `<span class="cap">${esc(n.name)}</span>`)}</a>`).join('')}</div>` : ''}
        </div>
        <aside class="dside"><div class="panel sticky">
          <h2>Как добраться</h2>
          <div class="mapbox" id="map"></div>
          <a class="btn ink block" target="_blank" rel="noopener" href="${links.route(s)}">${I.nav(18)}Маршрут в Яндекс.Картах</a>
          <a class="btn ghost block" target="_blank" rel="noopener" href="${links.google(s)}">Открыть в Google Картах</a>
          <a class="btn ghost block pano" target="_blank" rel="noopener" href="${links.pano(s)}">${I.globe(18)}Панорама улицы</a>
          <p class="hint2">Панорама откроется в Яндекс.Картах в новой вкладке.</p>
        </div></aside>
      </div>
    </div>`,
  }
}

/* ───── бренд и достижения ───── */
function passportHtml() {
  const doneCities = new Set(S.done.map((d) => d.city))
  const stamps = CITIES.map((c) => {
    const got = doneCities.has(c)
    return `<div class="stampc${got ? ' got' : ''}" style="--lc:${lineColor(c)}"><span class="ring">${got ? I.check(22) : I.lock(18)}</span><b>${esc(c)}</b><small>${got ? 'Пройдено' : 'Ждёт вас'}</small></div>`
  }).join('')
  const A = [
    ['Первая прогулка', 'Пройдите свой первый маршрут', S.done.length >= 1],
    ['Дождь не страшен', 'Перестройте маршрут под крышу', !!S.flags?.rain],
    ['Коллекционер', 'Сохраните три маршрута в избранное', S.favs.length >= 3],
    ['Автор', 'Опубликуйте свой маршрут', S.mine.length >= 1],
    ['Три города', 'Пройдите маршруты в трёх городах', doneCities.size >= 3],
  ]
  const n = A.filter((a) => a[2]).length
  return `<h2>Паспорт путешественника</h2>
    <div class="stampgrid">${stamps}</div>
    <h2>Достижения <span class="cnt">${n} из ${A.length}</span></h2>
    <ul class="ach">${A.map(([a, d, ok]) => `<li class="${ok ? 'got' : ''}"><span class="aic">${ok ? I.check(18) : I.lock(16)}</span><div><b>${a}</b><small>${d}</small></div></li>`).join('')}</ul>`
}

const COLORS = [
  ['Глубокий синий', '--ink', '#103D4C', 'Текст и тёмные поверхности'],
  ['Зелёный', '--green', '#087F63', 'Основное действие и выбранные элементы'],
  ['Светлый фон', '--mist', '#F5F7F5', 'Фон страниц'],
  ['Бумага', '--paper', '#FFFFFF', 'Карточки и панели'],
  ['Охра', '--gold', '#D69A28', 'Рейтинг и советы'],
  ['Фирменный знак', '--brand', '#12AD89', 'Логотип и декоративные линии'],
]
const FONT_ROWS = [
  ['Display', 'Onest 700, 40/1.12', 'Куда пойдём сегодня?', 'font:700 34px/1.12 var(--f-display);letter-spacing:-.02em'],
  ['Заголовок', 'Onest 700, 24', 'Москва-река и Зарядье', 'font:700 24px/1.25 var(--f-body)'],
  ['Подзаголовок', 'Onest 700, 18', 'Что внутри', 'font:700 18px/1.3 var(--f-body)'],
  ['Текст', 'Onest 400, 16–17 / 1.6', 'Современный парк, панорамы Кремля и уютные кафе с видом на реку.', 'font:400 17px/1.6 var(--f-body)'],
  ['Подпись', 'Onest 500, 14', '30 мин, бесплатно, под крышей', 'font:500 14px/1.4 var(--f-body);color:var(--muted)'],
]

function brandView() {
  return {
    title: 'Дизайн-система',
    html: `<div class="page brandpage">
      <header class="pagehead"><h1>Дизайн-система GeoVibe</h1><p class="lead">За впечатлениями: зелёный горный знак, фотографии города и готовые планы прогулок. Собственный язык GeoVibe из вашего референса.</p></header>

      <section class="bsec bhero">
        <div><img src="icons/logo.svg" width="120" height="80" alt="Горный знак GeoVibe"></div>
        <div class="bhero-t"><h2>Логотип</h2><p>Зелёные вершины из вашего референса. Знак связывает название GeoVibe с прогулками, открытиями и движением. Восстановлен в SVG по изображению.</p><div class="btnrow"><a class="btn ghost" href="icons/icon-512.png" download>Скачать PNG</a><a class="btn ghost" href="icons/favicon.svg" download>Скачать SVG</a></div></div>
        <div class="bhero-art">${metroArt()}</div>
      </section>

      <section class="bsec"><h2>Цвета</h2><p class="bnote">Нажмите на цвет, чтобы скопировать код.</p>
        <div class="swatches">${COLORS.map(([n, v, h, d]) => `<button class="sw" data-act="copy" data-v="${h}"><i style="background:${h}"></i><b>${n}</b><code>${h}</code><small>${v}. ${d}</small></button>`).join('')}</div>
        <h3>Линии городов</h3><p class="bnote">Каждому городу достаётся свой цвет линии. Он появляется на бейджах, кружках станций и маркерах карты.</p>
        <div class="swatches">${CITIES.map((c) => `<button class="sw" data-act="copy" data-v="${lineColor(c)}"><i style="background:${lineColor(c)}"></i><b>${c}</b><code>${lineColor(c)}</code></button>`).join('')}</div>
      </section>

      <section class="bsec"><h2>Шрифты</h2><p class="bnote">Onest для заголовков, цифр и основного текста. Предложения с заглавной, без капса.</p>
        <div class="typerows">${FONT_ROWS.map(([n, d, s, st]) => `<div class="trow"><div class="tmeta"><b>${n}</b><small>${d}</small></div><div style="${st}">${s}</div></div>`).join('')}</div>
      </section>

      <section class="bsec"><h2>Фирменный элемент: станция на линии</h2><p class="bnote">Остановки маршрута всегда рисуются станциями. Цвет линии — цвет города, между станциями — время и расстояние пешком.</p>
        <div class="demo2"><div class="demo-line">${lineList(CATALOG[1].stops.slice(0, 3), lineColor('Москва'), 'Пешком', false)}</div>
        <div class="demo-h"><ol class="hline" style="--lc:${lineColor('Санкт-Петербург')}"><li><span class="dot">1</span><span class="hn">Дом Зингера</span></li><li><span class="dot">2</span><span class="hn">Спас на Крови</span></li><li><span class="dot">3</span><span class="hn">Мойка</span></li></ol></div></div>
      </section>

      <section class="bsec"><h2>Кнопки и элементы</h2>
        <div class="demo3">
          <div class="btnrow"><button class="btn ink">Построить маршрут</button><button class="btn coral">${I.spark(18)}Гоу?</button><button class="btn ghost">Подписаться</button><button class="btn ink" disabled>Недоступно</button></div>
          <div class="chips wrap"><button class="chip on">Все города</button><button class="chip"><i style="background:#12AD89"></i>Москва</button><button class="chip soft">Закат</button><button class="chip soft on">Под крышей</button></div>
          <div class="facts big">${lineBadge('Москва')}<span class="fact">${I.walk(15)}Пешком</span><span class="fact">${I.clock(15)}2,5 ч</span><span class="fact star">${I.star(15)}4,9 <em>(203)</em></span></div>
          <div class="stats"><div><b>2,5 ч</b><span>время</span></div><div><b>4,1 км</b><span>длина</span></div><div><b>~800 ₽</b><span>стоимость</span></div></div>
          <div class="tip">${I.bulb(20)}<div><b>Совет</b><p>Приходите к открытию: утром меньше людей.</p></div></div>
        </div>
      </section>

      <section class="bsec"><h2>Голос и тексты</h2>
        <div class="voice">
          <div><b>Говорим как знающий друг</b><p>Коротко и по делу: «Пошёл дождь? Перестроим маршрут под крышу».</p></div>
          <div><b>Кнопка называет действие</b><p>«Сохранить в избранное», а не «Отправить». Одно действие называем одинаково везде.</p></div>
          <div><b>Пишем про человека, не про систему</b><p>«Нет подходящей замены рядом», а не «Ошибка поиска».</p></div>
          <div><b>Не обещаем лишнего</b><p>Цены и погоду называем примерными: «~600 ₽».</p></div>
        </div>
      </section>

      <section class="bsec"><h2>Основы</h2>
        <ul class="rules"><li>Форма: скругления 14, 20 и 28 px, кнопки 14, чипы полностью круглые.</li><li>Тени почти не используем, форму держат тонкие границы.</li><li>Движение: линия рисуется один раз при появлении, всё остальное отвечает на действие.</li><li>Доступность: контраст не ниже 4.5:1, видимый фокус, уважаем «уменьшить анимацию».</li></ul>
        <p class="bnote">Палитра, типографика и компоненты этой страницы используются во всех разделах приложения.</p>
      </section>
    </div>`,
  }
}

function creditsView() {
  return { title: 'Источники фотографий', html: `<div class="page credits-page">${crumb('Назад')}<header class="pagehead"><h1>Фото наших маршрутов</h1><p class="lead">Авторы и лицензии снимков, включённых в приложение. Фотографии уменьшены для приложения; в интерфейсе показывается кадрированная область.</p></header><div class="credits-grid">${Object.entries(PHOTO_CREDITS).map(([file, c]) => `<article class="panel"><img src="assets/photos/${esc(file)}" width="400" height="240" loading="lazy" alt="${esc(c.title)}"><h2>${esc(c.title)}</h2><p>${esc(c.author)}</p><a href="${esc(c.commons || c.source)}" target="_blank" rel="noopener">Источник фотографии</a><a href="${esc(c.license_url || c.commons || c.source)}" target="_blank" rel="noopener">${esc(c.license)}</a></article>`).join('')}</div><p class="bnote">Дополнительные фотографии галерей загружаются из Wikimedia и подписаны непосредственно на снимке.</p></div>` }
}

const notFound = () => ({
  title: 'Не найдено',
  html: `<div class="page narrow"><div class="empty"><h3>Такого маршрута нет</h3><p>Возможно, он был удалён или ссылка устарела.</p><a class="btn ink" href="#/">К маршрутам</a></div></div>`,
})
const redirect = (h) => {
  setTimeout(() => nav(h), 0)
  return { title: 'GeoVibe', html: '' }
}

/* ───────────────────────── роутер ───────────────────────── */
const nav = (h) => {
  if (location.hash === h) render()
  else location.hash = h
}
const TABS = [
  { id: 'feed', href: '#/', label: 'Маршруты', icon: 'home' },
  { id: 'go', href: '#/go', label: 'Гоу?', icon: 'spark' },
  { id: 'favs', href: '#/favs', label: 'Избранное', icon: 'heart' },
  { id: 'me', href: '#/me', label: 'Профиль', icon: 'user' },
]
const tabOf = (name) => ({ '': 'feed', r: 'feed', go: 'go', result: 'go', plan: 'go', walk: 'go', fav: 'favs', favs: 'favs', me: 'me', new: 'me', s: 'feed', brand: 'me' })[name] || 'feed'

function renderNav(active) {
  const html = TABS.map((t) => `<a href="${t.href}" class="${t.id === active ? 'on' : ''}"${t.id === active ? ' aria-current="page"' : ''}>${I[t.icon](24, t.id === active && t.id === 'favs')}<span>${t.label}</span></a>`).join('')
  $('#nav-side').innerHTML = html
  $('#nav-tab').innerHTML = html
  $('.topbar-title').textContent = ({feed:'Исследовать',go:'Ваш маршрут',favs:'Избранное',me:'Личный кабинет'})[active] || 'GeoVibe'
}

let lastKey = ''
function render(keepScroll) {
  const parts = location.hash.replace(/^#\/?/, '').split('/')
  const name = parts[0] || ''
  const arg = decodeURIComponent(parts.slice(1).join('/'))
  let v
  switch (name) {
    case '': v = feed(); break
    case 'r': v = routeDetail(arg); break
    case 'go': v = goView(); break
    case 'result': v = resultView(); break
    case 'plan': v = planView(); break
    case 'fav': {
      const r = S.favs.find((x) => x.id === arg)
      if (!r) { v = notFound(); break }
      ctx.plan = { route: r, rain: false }
      ctx.rateOpen = false
      ctx.rating = 0
      v = planView()
      break
    }
    case 'favs': v = favsView(); break
    case 'me': v = profileView(); break
    case 'new': v = createView(); break
    case 's': v = stopView(arg); break
    case 'walk': v = walkView(); break
    case 'brand': v = brandView(); break
    case 'credits': v = creditsView(); break
    default: v = notFound()
  }
  const y = window.scrollY
  activeMap?.destroy()
  activeMap = null
  $('#view').innerHTML = v.html + '<footer class="app-footer"><span>GeoVibe — за впечатлениями</span><a href="#/credits">Источники фотографий</a></footer>'
  document.title = v.title === 'Маршруты' ? 'GeoVibe — маршруты для прогулок' : `${v.title} — GeoVibe`
  renderNav(tabOf(name))
  document.body.dataset.view = name
  refreshInstallPrompt()
  syncChatViewport()
  activeMap = v.after?.()
  hydrate()
  const key = location.hash
  if (keepScroll === true && key === lastKey) window.scrollTo(0, y)
  else window.scrollTo(0, 0)
  lastKey = key
}

/* ───────────────────────── действия ───────────────────────── */
function toggleFav(r) {
  const has = isFav(r.id)
  S.favs = has ? S.favs.filter((x) => baseId(x.id) !== baseId(r.id)) : [r, ...S.favs]
  save()
  toast(has ? 'Убрано из избранного' : 'Сохранено в избранное')
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.skip')) {
    e.preventDefault()
    $('#view').focus()
    return
  }
  const el = e.target.closest('[data-act]')
  if (!el) return
  const a = el.dataset.act
  const v = el.dataset.v
  if (a === 'fav-card') e.preventDefault()
  switch (a) {
    case 'chat-reset':
      clearTimeout(ctx.chatJob);ctx.chatJob=null;ctx.chat=[];ctx.chatQuery=null;ctx.chatDraft='';ctx.busy=false;ctx.prefill='';render();break
    case 'chat-start':
    case 'chat-details': {
      const result=ctx.chat[Number(el.dataset.i)]?.result
      if(!result)break
      ctx.result=result
      if(a==='chat-start')startWalk(result.route)
      else nav('#/result')
      break
    }
    case 'photo-prev':
    case 'photo-next':
      movePhoto(el.closest('.place-gallery')?.querySelector('[data-gallery]'),a==='photo-prev'?-1:1)
      break
    case 'visit-place': {
      const stop=STOP_POOL.find(s=>s.id===el.dataset.id)
      if(!stop) break
      const photo=placeData(stop)?.thumb || all().find(r=>r.city===stop.city)?.photo || ''
      startWalk({id:`place-${stop.id}`,title:`Прогулка: ${stop.name}`,city:stop.city,transport:'Пешком',stops:[stop],photo,...meta([stop]),author:'GeoVibe',handle:'geovibe',tags:[],likes:0,rating:0,desc:STOPINFO[stop.id]?.desc || stop.note})
      break
    }
    case 'walk-start': {
      const route = el.dataset.source === 'result' ? ctx.result?.route : el.dataset.id ? all().find(r=>r.id===el.dataset.id) : ctx.plan?.route
      if(route) startWalk(route)
      break
    }
    case 'walk-overview':
      e.preventDefault()
      ctx.plan={route:ctx.walk.route,rain:false}
      nav('#/plan')
      break
    case 'walk-locate': activeMap?.locate(); break
    case 'walk-jump':
    case 'walk-prev':
    case 'walk-next': {
      const w=ctx.walk
      if(!w || w.finished) break
      if(a==='walk-next' && w.index===w.route.stops.length-1) w.finished=true
      else w.index=Math.max(0,Math.min(w.route.stops.length-1,a==='walk-jump'?Number(el.dataset.i):w.index+(a==='walk-prev'?-1:1)))
      saveWalk()
      render()
      $('#view').focus({preventScroll:true})
      break
    }
    case 'walk-restart':
      ctx.walk.index=0;ctx.walk.finished=false;saveWalk();render();break
    case 'walk-review':
      ctx.plan={route:ctx.walk.route,rain:false};ctx.rateOpen=true;ctx.rating=0;nav('#/plan');break
    case 'back':
      steps > 0 ? history.back() : nav('#/')
      break
    case 'city':
      F.city = v
      render(true)
      break
    case 'say':
      say(v)
      break
    case 'follow': {
      const h = el.dataset.h
      S.follows = S.follows.includes(h) ? S.follows.filter((x) => x !== h) : [...S.follows, h]
      save()
      render(true)
      break
    }
    case 'share': {
      const url = location.href
      if (navigator.share) navigator.share({ title: document.title, url }).catch(() => {})
      else navigator.clipboard?.writeText(url).then(() => toast('Ссылка скопирована'), () => toast('Не удалось скопировать ссылку'))
      break
    }
    case 'build': {
      const r = all().find((x) => x.id === el.dataset.id)
      const q = { text: r.title, city: $('#p-city').value, hours: Number($('#p-hrs').value), hoursGiven: true, transport: $('#p-tr').value, rain: false, tags: r.tags }
      const g = generate(q, all(), { prefer: r.id })
      if (!g) return toast('Для этого города пока нет маршрутов')
      ctx.result = g
      nav('#/result')
      break
    }
    case 'another': {
      const g = ctx.result
      const next = generate(g.q, all(), { tried: g.tried })
      if (!next) return toast('Других вариантов пока нет')
      ctx.result = next
      render()
      break
    }
    case 'open-plan':
      ctx.plan = { route: ctx.result.route, rain: ctx.result.q.rain }
      ctx.rateOpen = false
      ctx.rating = 0
      nav('#/plan')
      break
    case 'swap': {
      const p = ctx.plan
      const i = Number(el.dataset.i)
      const rep = findReplacement(p.route, i, p.rain)
      if (!rep) return toast('Подходящей замены рядом нет')
      const old = p.route.stops[i].name
      const stops = p.route.stops.map((s, j) => (j === i ? rep : s))
      const m = meta(stops)
      p.route = { ...p.route, stops, ...m }
      toast(`«${old}» заменена на «${rep.name}»`)
      render(true)
      break
    }
    case 'rain': {
      const p = ctx.plan
      p.rain = !p.rain
      if (p.rain) {
        S.flags.rain = true
        save()
        let cur = p.route
        cur.stops.forEach((st, i) => {
          if (st.indoor) return
          const rep = findReplacement(cur, i, true)
          if (rep) cur = { ...cur, stops: cur.stops.map((x, j) => (j === i ? rep : x)) }
        })
        p.route = { ...cur, ...meta(cur.stops) }
        toast('Перестроили маршрут: больше мест под крышей')
      }
      render(true)
      break
    }
    case 'fav-plan':
      toggleFav({ ...ctx.plan.route })
      render(true)
      break
    case 'rate-open':
      ctx.rateOpen = true
      render(true)
      break
    case 'star':
      ctx.rating = Number(v)
      render(true)
      break
    case 'rate-send': {
      const r = ctx.plan.route
      S.done = [{ id: r.id, title: r.title, city: r.city, rating: ctx.rating, at: Date.now() }, ...S.done]
      save()
      ctx.rateOpen = false
      toast('Маршрут засчитан, спасибо за оценку!')
      render(true)
      break
    }
    case 'fav-city':
      ctx.favCity = v
      render(true)
      break
    case 'ptab':
      ctx.profileTab = v
      render(true)
      break
    case 'pick': {
      const c = ctx.create
      const id = el.dataset.id
      c.picked = c.picked.includes(id) ? c.picked.filter((x) => x !== id) : [...c.picked, id]
      render(true)
      break
    }
    case 'publish': {
      const c = ctx.create
      const stops = c.picked.map((id) => STOP_POOL.find((s) => s.id === id)).filter(Boolean)
      if (!c.title.trim()) return toast('Назовите маршрут')
      if (stops.length < 2) return toast('Выберите минимум две точки')
      const m = meta(stops)
      const cover0 = all().find((r) => r.city === c.city)?.photo ?? ''
      S.mine = [{ id: `my-${Date.now()}`, title: c.title.trim(), city: c.city, transport: c.tr, ...m, author: 'Анна Петрова', handle: 'anna_travel', likes: 0, rating: 0, reviews: 0, desc: c.desc.trim() || 'Авторский маршрут', tags: [], photo: cover0, stops, own: true }, ...S.mine]
      save()
      ctx.create = { title: '', desc: '', city: 'Москва', tr: 'Пешком', picked: [] }
      toast('Маршрут опубликован')
      nav('#/')
      break
    }
    case 'reset':
      if (confirm('Удалить избранное, подписки, пройденные и созданные маршруты на этом устройстве?')) {
        S = { favs: [], follows: [], done: [], mine: [], flags: {} }
        ctx.walk=null
        try {localStorage.removeItem(WALK_KEY)} catch {}
        save()
        toast('Данные сброшены')
        render()
      }
      break
    case 'install':
      installApp()
      break
    case 'tag':
      F.tag = v
      render(true)
      break
    case 'say-go':
      ctx.prefill = v
      nav('#/go')
      break
    case 'fav-route': {
      const route=all().find(r=>r.id===el.dataset.id)
      if(route) {toggleFav(route);render(true)}
      break
    }
    case 'fav-card': {
      const r = all().find((x) => x.id === el.dataset.id)
      if (!r) break
      toggleFav(r)
      const on = isFav(r.id)
      el.classList.toggle('on', on)
      el.setAttribute('aria-pressed', String(on))
      el.setAttribute('aria-label', on ? 'Убрать из избранного' : 'Сохранить в избранное')
      el.innerHTML = I.heart(18, on)
      break
    }
    case 'copy':
      navigator.clipboard?.writeText(v).then(() => toast(`Скопировано: ${v}`), () => toast(v))
      break
  }
})

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]')
  if (!form) return
  e.preventDefault()
  if (form.dataset.form === 'ask') {
    ctx.prefill = $('#ask-in').value.trim() || SAMPLE
    nav('#/go')
  } else say($('#go-in').value)
})

document.addEventListener('keydown', (e) => {
  if (e.target.id === 'go-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    say($('#go-in').value)
  }
})

document.addEventListener('change', (e) => {
  const id = e.target.id
  if (id === 'f-tr') { F.tr = e.target.value; $('#grid').innerHTML = gridHtml() }
  else if (id === 'f-time') { F.time = e.target.value; $('#grid').innerHTML = gridHtml() }
  else if (id === 'c-city') { ctx.create.city = e.target.value; ctx.create.picked = []; render(true) }
  else if (id === 'c-tr') ctx.create.tr = e.target.value
})
document.addEventListener('input', (e) => {
  const id = e.target.id
  if (id === 'go-in') ctx.chatDraft=e.target.value
  else if (id === 'f-q') { F.q = e.target.value; $('#grid').innerHTML = gridHtml() }
  else if (id === 'c-title') ctx.create.title = e.target.value
  else if (id === 'c-desc') ctx.create.desc = e.target.value
})

/* ───────────────────────── PWA ───────────────────────── */
function syncInstallUi() {
  const can = !!deferredInstall && !standalone()
  const side = $('#install-side')
  if (side) side.hidden = !can
  const p = $('#install-prof')
  if (p) p.hidden = !can
  const hint = $('#install-hint')
  if (hint) hint.hidden = can
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstall = e
  syncInstallUi()
})
window.addEventListener('appinstalled', () => {
  deferredInstall = undefined
  syncInstallUi()
  toast('GeoVibe установлен')
})
async function installApp() {
  if (!deferredInstall) return
  deferredInstall.prompt()
  await deferredInstall.userChoice.catch(() => {})
  deferredInstall = undefined
  syncInstallUi()
}

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

let steps = 0 // сколько переходов сделано внутри приложения (для кнопки «Назад»)
window.addEventListener('hashchange', () => {
  steps++
  render()
})
render()
initInstallPrompt()
initChatViewport()
