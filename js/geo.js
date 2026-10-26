export function dist(a, b) {
    const R = 6371;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
/** Итоговые параметры маршрута по списку остановок */
export function meta(stops) {
    const n = stops.length;
    const minutes = stops.reduce((s, x) => s + x.min, 0) + Math.max(0, n - 1) * 10;
    const hours = Math.max(0.5, Math.round(minutes / 30) / 2);
    let km = 0;
    for (let i = 1; i < n; i++)
        km += dist(stops[i - 1], stops[i]) * 1.3;
    km = Math.round(km * 10) / 10;
    const cost = stops.reduce((s, x) => s + x.cost, 0);
    return { hours, km, cost };
}
export const fmtH = (h) => `${String(h).replace('.', ',')} ч`;
export const fmtKm = (km) => `${String(km).replace('.', ',')} км`;
export const fmtCost = (c) => c === 0 ? 'Бесплатно' : `~${c.toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;
