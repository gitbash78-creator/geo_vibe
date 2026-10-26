import { createVectorMap } from './vector-map.js'
/* GeoVibe maps: OpenFreeMap + local MapLibre, no API keys.
   GPS runs only in a foreground map and is cleared when leaving it. */
import { dist } from './geo.js'
import { STOP_POOL } from './routes.js'
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
function schemeSvg(stops, color, position, activeIndex) {
  const points = [...stops, ...(position ? [{...position, name:'Вы здесь'}] : [])]
  const W=640, H=420, pad=75
  const k=Math.cos(points.reduce((a,s)=>a+s.lat,0)/points.length*Math.PI/180)
  const xs=points.map(s=>s.lng*k), ys=points.map(s=>s.lat)
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys)
  const scale=Math.min((W-pad*2)/Math.max(maxX-minX,.002),(H-pad*2)/Math.max(maxY-minY,.002))
  const coords=points.map(s=>({x:W/2+(s.lng*k-(minX+maxX)/2)*scale,y:H/2-(s.lat-(minY+maxY)/2)*scale,name:s.name}))
  const pts=coords.slice(0,stops.length), target=pts[activeIndex ?? 0], user=position ? coords.at(-1) : null
  return `<svg class="scheme" viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема остановок${position ? ' и вашего местоположения' : ''}" preserveAspectRatio="xMidYMid meet"><defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dce8df"/></pattern></defs><rect width="640" height="420" fill="#edf4ee"/><rect width="640" height="420" fill="url(#map-grid)"/><path d="${pts.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="8 8"/>${user ? `<path d="M${user.x} ${user.y}L${target.x} ${target.y}" stroke="#087f63" stroke-width="4" stroke-dasharray="7 7"/><circle cx="${user.x}" cy="${user.y}" r="18" fill="#3985df33"/><circle cx="${user.x}" cy="${user.y}" r="8" fill="#2878d4" stroke="white" stroke-width="3"/><text x="${user.x}" y="${user.y+32}" text-anchor="middle">Вы здесь</text>` : ''}${pts.map((p,i)=>`<g><circle cx="${p.x}" cy="${p.y}" r="${i===activeIndex?18:14}" fill="${i===activeIndex?color:'#fff'}" stroke="${color}" stroke-width="4"/><text class="n" style="fill:${i===activeIndex?'#fff':'#103d4c'}" x="${p.x}" y="${p.y+5}" text-anchor="middle">${i+1}</text><text x="${p.x}" y="${p.y-29}" text-anchor="${p.x>440?'end':p.x<200?'start':'middle'}">${esc(p.name.length>27?p.name.slice(0,26)+'…':p.name)}</text></g>`).join('')}</svg><span class="map-mode">Схема · линии по прямой</span>`
}
const pathCache = new Map()
async function walkingPath(from, to, signal) {
  const key=[from.lat.toFixed(4),from.lng.toFixed(4),to.lat,to.lng].join(',')
  if (pathCache.has(key)) return pathCache.get(key)
  const url=`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`
  const res=await fetch(url,{signal,cache:'no-store'}); if(!res.ok) throw new Error('routing')
  const data=await res.json(), route=data.routes?.[0]
  if(data.code!=='Ok' || !route?.geometry?.coordinates?.length) throw new Error('routing')
  pathCache.set(key,route); if(pathCache.size>60) pathCache.delete(pathCache.keys().next().value)
  return route
}
export function drawMap(el, stops, color='#087f63', options={}) {
  if(!el || !stops.length) return
  let map, approach, watch, position, disposed=false, initialFit=false, lastRequest=0, lastOrigin, request, currentPath, resumeGps=false
  const active=Number.isInteger(options.activeIndex)?options.activeIndex:undefined
  const target=stops[active ?? 0]
  const status=(message)=>{ if(!disposed) options.onStatus?.(message) }
  const fallback=()=>{ if(!disposed) {delete el.dataset.mapReady;el.innerHTML=schemeSvg(stops,color,position,active)} }
  const fit=()=>{
    if(!map) return
    const points=position && active!==undefined ? [[position.lat,position.lng],[target.lat,target.lng]] : stops.map(s=>[s.lat,s.lng])
    map.fit(points.map(([lat,lng])=>({lat,lng})))
  }
  const update=async()=>{
    if(disposed || !position) return
    if(map) {
      map.setUser(position)
      if(!initialFit) {fit();initialFit=true}
    } else fallback()
    const km=dist(position,target)
    options.onLocation?.({...position,km})
    if(active===undefined) {status(`Местоположение определено · точность ±${Math.round(position.accuracy)} м`);return}
    if(position.accuracy>200) {status(`Низкая точность GPS: ±${Math.round(position.accuracy)} м. Ожидаем более точную позицию.`);return}
    if(map && !approach) {map.setApproach(currentPath ? currentPath.geometry.coordinates : [[position.lng,position.lat],[target.lng,target.lat]],!!currentPath);approach=true}
    if(km<.06) {status('Вы рядом с остановкой. Осмотритесь и прочитайте её историю.');return}
    if(km>30) {status('Вы далеко от остановки. Приблизьте карту или откройте путь в Яндекс.Картах.');return}
    if(Date.now()-lastRequest<20000 || (lastOrigin && dist(lastOrigin,position)<.04)) return
    lastRequest=Date.now();lastOrigin=position
    status('Строим пешеходный путь…')
    request?.abort();request=new AbortController();const current=request
    const timer=setTimeout(()=>current.abort(),10000)
    try {
      const path=await walkingPath(position,target,current.signal)
      if(disposed) return
      currentPath=path
      if(map) {map.setApproach(path.geometry.coordinates,true);approach=true}
      const label=el.querySelector('.map-mode');if(label && map) label.textContent=`Пешком к остановке ${(active ?? 0)+1}`
      status(map?`Пешком около ${Math.max(1,Math.round(path.duration/60))} мин · ${(path.distance/1000).toFixed(1).replace('.',',')} км по дорожкам`:'Подложка недоступна. На схеме показано направление по прямой.')
    } catch {status('Путь по дорожкам недоступен. Пунктир показывает направление по прямой; точный путь откройте в Яндекс.Картах.')}
    finally {clearTimeout(timer)}
  }
  const controller={
    locate() {
      if(disposed) return
      if(!window.isSecureContext) return status('Для геолокации откройте приложение по HTTPS или на localhost.')
      if(!navigator.geolocation) return status('Геолокация недоступна в этом браузере. Откройте путь в Яндекс.Картах.')
      if(watch!==undefined) {fit();return}
      status('Определяем ваше местоположение…')
      watch=navigator.geolocation.watchPosition(p=>{
        if(disposed) return
        position={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};update()
      },e=>{ if(disposed) return; status(e.code===1?'Доступ к местоположению закрыт. Разрешите его в настройках браузера или откройте Яндекс.Карты.':e.code===3?'GPS пока не ответил. Ожидаем позицию; можно открыть путь в Яндекс.Картах.':'Не удалось определить местоположение. Проверьте GPS и попробуйте ещё раз.');if(e.code!==3){navigator.geolocation.clearWatch(watch);watch=undefined} },{enableHighAccuracy:true,maximumAge:5000,timeout:15000})
    },
    destroy() {disposed=true;request?.abort();document.removeEventListener('visibilitychange',visibility);if(watch!==undefined) navigator.geolocation.clearWatch(watch);map?.destroy()},
  }
  const visibility=()=>{
    if(document.hidden && watch!==undefined) {navigator.geolocation.clearWatch(watch);watch=undefined;resumeGps=true;request?.abort()}
    else if(!document.hidden && resumeGps) {resumeGps=false;controller.locate()}
  }
  document.addEventListener('visibilitychange',visibility)
  fallback()
  if(navigator.onLine) {
    const nearby=STOP_POOL.filter(s=>s.city===target.city && !stops.some(p=>p.id===s.id || dist(p,s)<.055) && Math.min(...stops.map(p=>dist(p,s)))<2.5).sort((a,b)=>dist(a,target)-dist(b,target)).slice(0,18)
    createVectorMap(el,stops,{color,active,nearby,isDisposed:()=>disposed}).then(renderer=>{
      if(!renderer)return
      if(disposed){renderer.destroy();return}
      map=renderer;fit();if(position)update()
      renderer.ready.catch(()=>{if(disposed)return;renderer.destroy();if(map===renderer)map=null;approach=null;fallback();status('Подложка недоступна. Показана схема с направлением по прямой.')})
    }).catch(()=>{fallback();status('Карта недоступна. Показана схема маршрута.')})
  }
  if(options.autoLocate) controller.locate()
  return controller
}
