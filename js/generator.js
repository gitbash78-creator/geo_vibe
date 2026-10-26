import { CITIES, STOP_POOL } from './routes.js';
import { dist, fmtH, meta } from './geo.js';
/**
 * Шаблонный «ИИ»: разбирает запрос по ключевым словам и подбирает маршрут из каталога.
 * Интерфейс (parseQuery → generate) рассчитан на то, чтобы позже заменить тело
 * на вызов LLM-API, не трогая UI.
 */
const CITY_RULES = [
    [/москв/i, 'Москва'],
    [/питер|петербург|спб/i, 'Санкт-Петербург'],
    [/казан/i, 'Казань'],
    [/коломн/i, 'Коломна'],
    [/суздал/i, 'Суздаль'],
];
const TAG_RULES = [
    [/романт|закат|свидан|вдвоем|вдвоём/i, ['романтика', 'закат']],
    [/дет|ребён|ребен|семь/i, ['дети']],
    [/гастро|поесть|еда|еду|ресторан|вкусн|пастил/i, ['гастро']],
    [/актив|бег|спорт|велос|вело/i, ['актив']],
    [/музе|выстав|галере|искусств/i, ['музеи']],
    [/кофе|кофейн|кафе|уютн|чай/i, ['кофе']],
    [/вид|панорам|красив|фото/i, ['виды']],
    [/природ|парк|лес|набережн|река|озер/i, ['природа']],
];
const number = value => Number(value.replace(/\s/g, '').replace(',', '.'))
export function parseQuery(text) {
    text = String(text || '').trim()
    const t = text.toLowerCase().replace(/ё/g, 'е')
    // The last city wins when someone changes their mind in the same message.
    let city, cityPosition = -1
    for (const [rule, name] of CITY_RULES) for (const match of t.matchAll(new RegExp(rule.source, 'gi'))) {
        if (match.index > cityPosition) { city = name; cityPosition = match.index }
    }
    let hours = 2.5, hoursMin = 0, hoursMax = 2.5, hoursGiven = false
    const unit = '(час(?:а|ов)?|ч(?![а-я])|минут(?:а|ы|у)?|мин(?![а-я]))'
    const range = t.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*[–—−-]\\s*(\\d+(?:[.,]\\d+)?)\\s*' + unit)) ||
        t.match(new RegExp('от\\s*(\\d+(?:[.,]\\d+)?)\\s*до\\s*(\\d+(?:[.,]\\d+)?)\\s*' + unit))
    const single = t.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*' + unit))
    if (range) {
        const scale = range[3].startsWith('мин') ? 1 / 60 : 1
        hoursMin = Math.min(number(range[1]), number(range[2])) * scale
        hoursMax = Math.max(number(range[1]), number(range[2])) * scale
        hours = (hoursMin + hoursMax) / 2; hoursGiven = true
    } else if (single) {
        hours = number(single[1]) * (single[2].startsWith('мин') ? 1 / 60 : 1)
        const extraMinutes = !single[2].startsWith('мин') && t.slice(single.index + single[0].length).match(/^\s*(?:и\s*)?(\d+)\s*мин/)
        if (extraMinutes) hours += number(extraMinutes[1]) / 60
        hoursMax = hours; hoursGiven = true
    } else {
        const named = /полтора|полторы/.test(t) ? 1.5 : /полдня/.test(t) ? 4 : /весь день|целый день/.test(t) ? 6 : /пару часов|пара часов|час-два/.test(t) ? 2 : /(?:на|около)\s+час(?:$|[\s,.!?])/.test(t) ? 1 : undefined
        if (named !== undefined) {hours = hoursMax = named; hoursGiven = true}
    }
    if (hoursGiven && (!Number.isFinite(hours) || hours <= 0)) {hours = hoursMax = 2.5; hoursMin = 0; hoursGiven = false}
    let transport
    const transportText = t.replace(/(?<![а-я])(?:без\s+метро|не\s+на\s+метро|не\s+на\s+машине|без\s+машины|без\s+авто)/g, '')
    if (/велос|вело/.test(transportText)) transport = 'Велосипед'
    else if (/метро/.test(transportText)) transport = 'Пешком + метро'
    else if (/машин|авто/.test(transportText)) transport = 'Авто'
    else if (/пешком|пешая|пешую|пеший|пешего/.test(transportText)) transport = 'Пешком'
    let budget
    const money = '(\\d+(?:[ \u00a0]\\d{3})*(?:[.,]\\d+)?)\\s*(тыс(?:яч[а-я]*)?|к(?=\\s|руб|₽|$))?\\s*(₽|руб[а-я]*|р(?=$|[\\s,.!?]))?'
    const explicit = [...t.matchAll(new RegExp('(?:бюджет(?:ом)?(?:\\s+до)?|не\\s+(?:дороже|больше|более)|стоимость(?:ю)?(?:\\s+до)?|потратить|до)\\s*' + money, 'g'))]
    for (const match of explicit) {
        const tail = t.slice(match.index + match[0].length)
        if (/^\s*(?:час|ч(?:$|[\s,.!?])|минут|мин(?:$|[\s,.!?]))/.test(tail) && !match[3]) continue
        if (!match[2] && !match[3] && !/бюджет|стоимость|потратить/.test(match[0]) && number(match[1]) < 100) continue
        budget = number(match[1]) * (match[2] ? 1000 : 1)
    }
    if (budget === undefined) {
        const amounts = [...t.matchAll(new RegExp(money, 'g'))].filter(m => m[2] || m[3])
        if (amounts.length) {const m=amounts.at(-1);budget=number(m[1])*(m[2]?1000:1)}
    }
    if (/бесплат|без затрат|без трат|не тратить/.test(t)) budget = 0
    const dry = /без\s+(?:дожд[а-я]*|осадков)|дожд[а-я]*\s+не\s+(?:будет|идет)|не\s+(?:будет|идет)\s+дожд[а-я]*|солнеч|ясн[а-я]*\s+погод/.test(t)
    const wetText = t.replace(/без\s+(?:дожд[а-я]*|осадков)|дожд[а-я]*\s+не\s+(?:будет|идет)|не\s+(?:будет|идет)\s+дожд[а-я]*/g, '')
    const rain = /дожд|ливень|непогод/.test(wetText)
    const weather = rain ? 'rain' : /снег|метель/.test(t) ? 'snow' : /холод|мороз/.test(t) ? 'cold' : /жарк|жар[акуы]|зной/.test(t) ? 'hot' : dry ? 'dry' : undefined
    const tags = new Set(), excludedTags = []
    for (const [rule, values] of TAG_RULES) {
        if (rule.test(t)) values.forEach(v=>tags.add(v))
    }
    if (/без\s+музе/.test(t)) excludedTags.push('музеи')
    if (/без\s+(?:кафе|кофе)/.test(t)) excludedTags.push('кофе')
    if (rain) tags.add('музеи')
    excludedTags.forEach(tag=>tags.delete(tag))
    return {text,city,hours,hoursMin,hoursMax,hoursGiven,transport,budget,rain,weather,tags:[...tags],excludedTags}
}
export function mergeQuery(previous, next) {
    if (!previous) return next
    const excludedTags=[...new Set([...(previous.excludedTags||[]),...next.excludedTags])].filter(tag=>!next.tags.includes(tag))
    return {...previous,...next,city:next.city || previous.city,transport:next.transport || previous.transport,
        budget:next.budget !== undefined ? next.budget : previous.budget,
        ...(next.hoursGiven ? {} : {hours:previous.hours,hoursMin:previous.hoursMin,hoursMax:previous.hoursMax,hoursGiven:previous.hoursGiven}),
        weather:next.weather || previous.weather,rain:next.weather ? next.rain : previous.rain,
        tags:(next.tags.length ? next.tags : previous.tags).filter(tag=>!excludedTags.includes(tag)),excludedTags,text:next.text}
}
export function weatherFor(city, rain) {
    if (rain === true || rain === 'rain')
        return { icon: '🌧️', temp: '+11°', text: 'Дождь' };
    if (rain === 'snow') return {icon:'🌨️',temp:'−2°',text:'Снег · предпочтение запроса'};
    if (rain === 'cold') return {icon:'❄️',temp:'+3°',text:'Холодно · предпочтение запроса'};
    if (rain === 'hot') return {icon:'☀️',temp:'+28°',text:'Жарко · предпочтение запроса'};
    const w = {
        Москва: { icon: '☀️', temp: '+18°', text: 'В основном ясно' },
        'Санкт-Петербург': { icon: '⛅', temp: '+15°', text: 'Облачно, без дождя' },
        Казань: { icon: '☀️', temp: '+19°', text: 'Ясно' },
        Коломна: { icon: '🌤️', temp: '+17°', text: 'Малооблачно' },
        Суздаль: { icon: '🌤️', temp: '+16°', text: 'Малооблачно' },
    };
    return w[city] ?? { icon: '🌤️', temp: '+16°', text: 'Без осадков' };
}
/** Ближайшая замена точке (в приоритете — под крышей, если дождь) */
export function findReplacement(route, idx, rain) {
    const target = route.stops[idx];
    const used = new Set(route.stops.map((s) => s.id));
    let cands = STOP_POOL.filter((s) => s.city === route.city && !used.has(s.id));
    if (rain) {
        const indoor = cands.filter((s) => s.indoor);
        if (indoor.length)
            cands = indoor;
    }
    if (!cands.length)
        return null;
    // тип заменяемой точки сохраняем: еда ↔ еда, прогулка ↔ прогулка
    const sameKind = cands.filter((s) => (s.cost > 0) === (target.cost > 0));
    const pool = sameKind.length ? sameKind : cands;
    return pool.sort((a, b) => dist(a, target) - dist(b, target))[0];
}
const isFood = (s) => /кафе|кофей|чайхан|гастро/i.test(s.name);
const samePlace = (a,b) => a.id===b.id || a.name.toLowerCase().replace(/[«»]/g,'')===b.name.toLowerCase().replace(/[«»]/g,'');
function fit(stops, q) {
    const city = q.city || stops[0]?.city
    const indoors = q.rain || ['snow','cold','hot'].includes(q.weather)
    const budget = q.budget ?? Infinity
    const maxHours = q.hoursMax ?? q.hours
    const minHours = q.hoursMin ?? 0
    const target = Math.min(q.hours, maxHours)
    const maxLeg = q.transport === 'Авто' ? 60 : q.transport === 'Велосипед' || q.transport === 'Пешком + метро' ? 15 : 5
    const candidates = [...new Map([...stops,...STOP_POOL.filter(s=>s.city===city)].map(s=>[s.id,s])).values()]
        .filter(s=>(!indoors || s.indoor) && s.cost <= budget && !((q.excludedTags||[]).includes('кофе') && isFood(s)) && !((q.excludedTags||[]).includes('музеи') && /музе|павильон|галере/i.test(s.name)))
    const out=[]
    const allowed = list => meta(list).cost <= budget && meta(list).hours <= maxHours && list.every((s,i)=>!i || dist(list[i-1],s)<=maxLeg)
    for(const original of stops) {
        const next = candidates.find(s=>s.id===original.id && !out.some(x=>samePlace(x,s))) ||
            [...candidates].filter(s=>!out.some(x=>samePlace(x,s))).sort((a,b)=>dist(a,original)-dist(b,original))[0]
        if(next && allowed([...out,next]))out.push(next)
    }
    // Extend a short catalogue route with nearby places to honour the requested minimum.
    while((out.length<2 || meta(out).hours<target) && out.length<14) {
        const remaining=candidates.filter(s=>!out.some(x=>samePlace(x,s)) && allowed([...out,s]))
        if(!remaining.length)break
        const anchor=out.at(-1) || stops[0]
        remaining.sort((a,b)=>{
            const priority=s=>dist(s,anchor)+(isFood(s)&&out.some(isFood)&&!q.tags.includes('гастро')?4:0)-(q.tags.includes('кофе')&&isFood(s)&&!out.some(isFood)?2:0)
            return priority(a)-priority(b)
        })
        out.push(remaining[0])
    }
    if((q.tags.includes('кофе') || q.tags.includes('гастро')) && !out.some(isFood)) {
        for(const food of candidates.filter(isFood)) {
            const revised=[...out.slice(0,-1),food]
            if(revised.length>=2 && allowed(revised) && meta(revised).hours>=minHours){out.splice(0,out.length,...revised);break}
        }
    }
    if(out.length<2 || meta(out).hours<minHours || !allowed(out))return null
    return out
}
const indoorShare = (r) => r.stops.filter((s) => s.indoor).length / r.stops.length;
function score(r, q, prefer) {
    let s = 0;
    const hit = r.tags.filter((t) => q.tags.includes(t)).length;
    s += hit * 3;
    s -= Math.abs(r.hours - q.hours) * 1.2;
    if (q.rain)
        s += indoorShare(r) * 4;
    if (q.transport && r.transport === q.transport)
        s += 2.5;
    if (q.transport && r.transport !== q.transport)
        s -= 1;
    if (q.budget !== undefined)
        s += r.cost <= q.budget ? 2 : -Math.min(4, (r.cost - q.budget) / 400);
    s += Math.log10(r.likes + 1) * 0.6; // слабый бонус за популярность
    if (prefer && r.id === prefer)
        s += 6;
    return s;
}
export function generate(q, all, opts = {}) {
    const pool = all.filter((r) => !q.city || r.city === q.city);
    if (!pool.length)
        return null;
    let tried = opts.tried ?? [];
    let avail = pool.filter((r) => !tried.includes(r.id));
    if (!avail.length) {
        tried = [];
        avail = pool;
    }
    const feasible=avail.map(base=>{
        const transport=q.transport ?? (q.budget===0?'Пешком':base.transport)
        const stops=fit(base.stops,{...q,city:q.city||base.city,transport})
        if(!stops)return null
        return {base,stops,transport,...meta(stops)}
    }).filter(Boolean)
    if(!feasible.length)return null
    const fitted=feasible.sort((a,b)=>score({...b.base,hours:b.hours,cost:b.cost},q,opts.prefer)-score({...a.base,hours:a.hours,cost:a.cost},q,opts.prefer))[0]
    const best=fitted.base, stops=fitted.stops, transport=fitted.transport, m=meta(stops)
    const changed=stops.map(s=>s.id).join()!==best.stops.map(s=>s.id).join()
    const route={...best,id:`gen-${best.id}-${Date.now()}`,title:changed?`${best.city}: прогулка под ваш запрос`:best.title,stops,...m,transport,own:false}
    const weather = weatherFor(route.city, q.weather || q.rain);
    const reasons = [];
    reasons.push(q.rain || ['snow','cold','hot'].includes(q.weather)
        ? {icon:'☂️',text:'Остановки под крышей; переходы между ними — по улице'}
        : {icon:'🌤️',text:q.weather==='dry'?'Учтено пожелание: прогулка без дождя':'Погода в приложении демонстрационная'})
    const hit = best.tags.filter(t=>q.tags.includes(t) && (!['кофе','гастро'].includes(t) || stops.some(isFood)) && (t!=='музеи' || stops.some(s=>/музе|павильон|галере/i.test(s.name))));
    if (hit.length)
        reasons.push({ icon: '✨', text: `Подходит под запрос: ${hit.join(', ')}` });
    else
        reasons.push({ icon: '👍', text: `Популярный (${best.likes} лайков)` });
    reasons.push({ icon: '⏱️', text: `${q.hoursMin>0?`Диапазон ${fmtH(q.hoursMin)}–${fmtH(q.hoursMax)}`:`До ${fmtH(q.hoursMax ?? q.hours)}`}: примерно ${fmtH(m.hours)}` });
    if (q.budget !== undefined)
        reasons.push({
            icon: '💸',
            text: q.budget===0?'Бесплатный маршрут':`В бюджете до ${q.budget} ₽`,
        });
    else
        reasons.push({ icon: '💸', text: m.cost === 0 ? 'Бесплатно' : 'Оптимальная цена' });
    return { route, weather, reasons: reasons.slice(0, 4), q, tried: [...tried, best.id] };
}
export const CITY_LIST = CITIES;
