import {placeData,placeEmoji,panoramaUrl} from './place-tools.js'
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const line = coordinates=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coordinates.length>1?coordinates:[coordinates[0],coordinates[0]]}})
let library
async function loadLibrary() {
  if(!document.querySelector('[data-maplibre]')) {
    const css=document.createElement('link');css.rel='stylesheet';css.href='assets/vendor/maplibre/maplibre-gl.css';css.dataset.maplibre='1';document.head.append(css)
  }
  library ||= import('../assets/vendor/maplibre/maplibre-gl.mjs').catch(e=>{library=null;throw e})
  return library
}
export async function createVectorMap(el,stops,{color,active,nearby,isDisposed}) {
  const gl=await loadLibrary()
  if(isDisposed() || !el.isConnected) return null
  gl.setWorkerUrl(new URL('../assets/vendor/maplibre/maplibre-gl-worker.mjs',import.meta.url).href)
  el.innerHTML='<div class="vector-map"></div><span class="map-mode">OpenFreeMap · остановки</span>'
  const native=new gl.Map({container:el.querySelector('.vector-map'),style:'https://tiles.openfreemap.org/styles/liberty',center:[stops[0].lng,stops[0].lat],zoom:14,attributionControl:false,cooperativeGestures:true})
  native.addControl(new gl.NavigationControl({showCompass:false}),'top-left')
  native.addControl(new gl.AttributionControl({compact:true}),'bottom-right')
  let destroyed=false,loaded=false,userMarker,userPosition,approachData,approachSolid=false
  const markers=[]
  const popup=(s,i)=>{
    const photo=placeData(s)?.photos?.[0]
    return `<div class="place-popup">${photo?`<img src="${esc(photo.url)}" alt="${esc(s.name)}" width="240" height="140" loading="lazy">`:''}<b>${placeEmoji(s)} ${esc(s.name)}</b><small>${i===undefined?'Рядом с маршрутом':`Остановка ${i+1}`} · ${s.min} мин</small><a href="#/s/${esc(s.id)}">Фото и описание</a><a href="${esc(panoramaUrl(s))}" target="_blank" rel="noopener">Панорама в Яндекс.Картах</a><button data-act="visit-place" data-id="${esc(s.id)}">Прогуляться сюда</button></div>`
  }
  const marker=(s,i)=>{
    const button=document.createElement('button');button.className=i===undefined?'nearby-place map-marker':`pin map-marker ${i===active?'active-pin':''}`;button.setAttribute('aria-label',s.name);button.innerHTML=i===undefined?`<span>${placeEmoji(s)}</span>`:`<span style="border-color:${color}">${i+1}</span>`
    markers.push(new gl.Marker({element:button}).setLngLat([s.lng,s.lat]).setPopup(new gl.Popup({offset:22,maxWidth:'260px'}).setHTML(popup(s,i))).addTo(native))
  }
  stops.forEach(marker);nearby.forEach(s=>marker(s))
  const drawApproach=()=>{
    if(!loaded || !approachData) return
    const data=line(approachData)
    if(native.getSource('approach'))native.getSource('approach').setData(data)
    else {native.addSource('approach',{type:'geojson',data});native.addLayer({id:'approach',type:'line',source:'approach',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#087f63','line-width':5}})}
    native.setPaintProperty('approach','line-dasharray',approachSolid?[1,0]:[1.5,1.5])
  }
  const renderer={
    fit(points) {if(destroyed)return;const bounds=new gl.LngLatBounds();points.forEach(p=>bounds.extend([p.lng,p.lat]));native.fitBounds(bounds,{padding:48,maxZoom:16,duration:0})},
    setUser(p) {
      if(destroyed)return
      userPosition=p
      if(userMarker)userMarker.setLngLat([p.lng,p.lat])
      else {const dot=document.createElement('div');dot.className='vector-user';dot.setAttribute('aria-label','Ваше местоположение');userMarker=new gl.Marker({element:dot}).setLngLat([p.lng,p.lat]).addTo(native)}
      userMarker.getElement().title=`Вы здесь · точность ±${Math.round(p.accuracy)} м`
    },
    setApproach(coordinates,solid) {approachData=coordinates;approachSolid=solid;drawApproach()},
    destroy(){destroyed=true;clearTimeout(timer);observer.disconnect();userMarker?.remove();markers.forEach(m=>m.remove());native.remove()},
  }
  const observer=new ResizeObserver(()=>{if(!destroyed)native.resize()});observer.observe(el)
  let timer
  renderer.ready=new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error('map-load-timeout')),12000)
    native.once('load',()=>{
      if(destroyed)return
      clearTimeout(timer);loaded=true;el.dataset.mapReady='true'
      native.addSource('stops',{type:'geojson',data:line(stops.map(s=>[s.lng,s.lat]))})
      native.addLayer({id:'stops',type:'line',source:'stops',paint:{'line-color':color,'line-width':3,'line-opacity':.6,'line-dasharray':[1.5,2]}})
      // Prefer Russian place labels where the vector data provides them.
      for(const layer of native.getStyle().layers)if(layer.type==='symbol' && layer.layout?.['text-field'])native.setLayoutProperty(layer.id,'text-field',['coalesce',['get','name:ru'],['get','name'],layer.layout['text-field']])
      if(userPosition)renderer.setUser(userPosition)
      drawApproach();resolve()
    })
    native.on('error',e=>{if(!loaded && /style|403|401|404/.test(e.error?.message||'')){clearTimeout(timer);reject(e.error)}})
  })
  return renderer
}
