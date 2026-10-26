import { STOPINFO } from './stopinfo.js'
import { LOCAL_PLACES } from './local-places.js'
import { PLACE_PHOTO_OVERRIDES } from './place-photo-overrides.js'
import { PHOTO_CREDITS } from './photo-credits.js'
const CAFE_IDS=['vdnh-4','zar-4','pat-3','cof-1','cof-3','mus-3','kid-3','gas-2','gas-3','kzk-4','kzs-4','kol-4','suz-4']
const CAFE_PHOTOS=['coffee.jpg','cafe-1.jpg','cafe-2.jpg','cafe-3.jpg','cafe-4.jpg','cafe-5.jpg'].map(file=>({url:'assets/photos/'+file,w:960,h:640,wide:false,credit:PHOTO_CREDITS[file].author,license:PHOTO_CREDITS[file].license,page:PHOTO_CREDITS[file].source}))
function illustrativeCafe(stop) {
  if(!/кафе|коф|чай|гастро/i.test(stop.name))return null
  const index=Math.max(0,CAFE_IDS.indexOf(stop.id))%CAFE_PHOTOS.length
  const photos=[CAFE_PHOTOS[index],CAFE_PHOTOS[(index+1)%CAFE_PHOTOS.length]]
  return {title:'Атмосфера кафе',illustrative:true,thumb:photos[0].url,photos}
}
export const placeData = stop => PLACE_PHOTO_OVERRIDES[stop.id] || LOCAL_PLACES[STOPINFO[stop.id]?.w] || illustrativeCafe(stop)
export const placeEmoji = stop => /кафе|коф|чай|гастро/i.test(stop.name) ? '☕' : /мост|набереж|озер|пруд|мойка/i.test(stop.name) ? '🌊' : /музе|павильон|космос/i.test(stop.name) ? '🏛️' : /храм|собор|мечеть|монастыр/i.test(stop.name) ? '⛪' : /парк|гор|сад/i.test(stop.name) ? '🌳' : /кремль|крепость/i.test(stop.name) ? '🏰' : '📍'
export const panoramaUrl = stop => `https://yandex.ru/maps/?ll=${stop.lng}%2C${stop.lat}&z=17&l=stv%2Csta&panorama%5Bpoint%5D=${stop.lng}%2C${stop.lat}`
