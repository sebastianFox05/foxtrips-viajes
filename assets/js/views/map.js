/* Mapa del viaje: un marcador por actividad y la ruta de cada dia, con filtro por dia. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { eachDay, esc, formatDay, sortActivities } from '../utils.js';

const DAY_COLORS = ['#f08a3c', '#2f80ed', '#9b51e0', '#27ae60', '#eb5757', '#f2c94c', '#56ccf2', '#bb6bd9'];

let map = null;
let layers = [];
let activities = [];
let days = [];
let activeDay = 'all';

function colorFor(day) {
  const index = days.indexOf(day);
  return index < 0 ? '#6b6b6b' : DAY_COLORS[index % DAY_COLORS.length];
}

function pinIcon(label, color) {
  return window.L.divIcon({
    className: '',
    html: `<span class="map-pin" style="background:${color}"><span class="map-pin__label">${esc(label)}</span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function draw(ctx, focusId) {
  const L = window.L;
  layers.forEach((layer) => layer.remove());
  layers = [];
  const located = activities.filter((activity) => activity.lat != null && (activeDay === 'all' || activity.day === activeDay));
  const bounds = [];
  const byDay = new Map();
  for (const activity of located) {
    const dayIndex = days.indexOf(activity.day);
    const marker = L.marker([activity.lat, activity.lon], { icon: pinIcon(dayIndex >= 0 ? dayIndex + 1 : '•', colorFor(activity.day)), title: activity.title })
      .addTo(map)
      .bindPopup(`<strong>${esc(activity.title)}</strong><br>${activity.day ? esc(formatDay(activity.day, { weekday: 'short', day: 'numeric', month: 'short' })) : 'Sin día'}${activity.time ? ` · ${esc(activity.time)}` : ''}<br>${esc(activity.place || '')}`);
    layers.push(marker);
    bounds.push([activity.lat, activity.lon]);
    if (activity.id === focusId) setTimeout(() => marker.openPopup(), 300);
    if (activity.day) byDay.set(activity.day, [...(byDay.get(activity.day) || []), [activity.lat, activity.lon]]);
  }
  byDay.forEach((points, day) => {
    if (points.length > 1) layers.push(L.polyline(points, { color: colorFor(day), weight: 4, opacity: 0.75, dashArray: '6 8' }).addTo(map));
  });
  const focus = activities.find((activity) => activity.id === focusId && activity.lat != null);
  if (focus) map.setView([focus.lat, focus.lon], 15);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
  else if (bounds.length === 1) map.setView(bounds[0], 14);
  else if (ctx.trip.lat != null) map.setView([ctx.trip.lat, ctx.trip.lon], 11);
  else map.setView([20, -40], 2);
}

function legendHtml() {
  const options = [{ key: 'all', label: 'Todos los días', color: '#141414' }]
    .concat(days.map((day, index) => ({ key: day, label: `Día ${index + 1}`, color: colorFor(day) })));
  return options.map((option) => `
    <li><button class="chip chip--plain ${option.key === activeDay ? 'chip--active' : ''}" type="button" data-action="map-day" data-day="${esc(option.key)}" aria-pressed="${option.key === activeDay}">
      <span class="map__swatch" style="--swatch:${option.color}" aria-hidden="true"></span>${esc(option.label)}
    </button></li>`).join('');
}

function mapDayHandler(button, event, ctx) {
  activeDay = button.dataset.day;
  document.getElementById('mapLegend').innerHTML = legendHtml();
  draw(ctx, null);
}

export default {
  async render(ctx) {
    activities = sortActivities(await store.list('activities', ctx.tripId));
    days = eachDay(ctx.trip.start_date, ctx.trip.end_date);
    if (activeDay !== 'all' && !days.includes(activeDay)) activeDay = 'all';
    const missing = activities.filter((activity) => activity.lat == null && activity.place).length;
    return `
      <section class="map" aria-labelledby="mapTitle">
        <div class="section__head">
          <h2 id="mapTitle">Mapa del viaje</h2>
          <span class="section__hint">${icon('pin', 14)} ${activities.filter((activity) => activity.lat != null).length} lugares</span>
        </div>
        <ul class="chips map__legend" id="mapLegend">${legendHtml()}</ul>
        <div class="map__canvas" id="mapCanvas" role="region" aria-label="Mapa interactivo con los lugares del viaje"></div>
        ${missing ? `<p class="section__hint">${missing} actividad(es) tienen lugar pero no se pudieron ubicar. Edítalas con una dirección más precisa.</p>` : ''}
      </section>`;
  },
  mount(ctx, root) {
    if (!window.L) {
      root.querySelector('#mapCanvas').innerHTML = '<p class="loading">No se pudo cargar el mapa (¿sin conexión?).</p>';
      return;
    }
    map = window.L.map(root.querySelector('#mapCanvas'), { scrollWheelZoom: false });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    draw(ctx, ctx.query.get('foco'));
  },
  unmount() {
    map?.remove();
    map = null;
    layers = [];
  },
  actions: { 'map-day': mapDayHandler }
};
