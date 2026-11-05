/* Pestaña Inicio del viaje: datos clave, accesos, proximos planes, clima, divisas y compartir. */
import { store } from '../store/index.js';
import { icon } from '../icons.js';
import { pictureHtml } from '../media.js';
import { forecast, rates, tripWeather, weatherInfo, CURRENCIES } from '../services.js';
import { nearestCityName } from '../places.js';
import { toast, toastError } from '../ui.js';
import { defaultCurrency, eachDay, esc, formatDay, formatMoney, sortActivities, today, tripStatus } from '../utils.js';
import { SECTIONS } from './shell.js';

const HOME_CURRENCY_KEY = 'foxtrips:home-currency';

let rateTable = null;
let tripActivities = [];

function homeCurrency() {
  return localStorage.getItem(HOME_CURRENCY_KEY) || defaultCurrency();
}

function infoItem(iconName, label, value) {
  return `
    <div class="info-row__item">
      <span class="info-row__icon">${icon(iconName)}</span>
      <div><span class="info-row__label">${label}</span><span class="info-row__value">${esc(value)}</span></div>
    </div>`;
}

function upcomingHtml(ctx, activities) {
  const now = today();
  const next = sortActivities(activities).filter((activity) => (activity.day || '') >= now).slice(0, 4);
  const list = next.length ? next : sortActivities(activities).slice(0, 4);
  if (!list.length) return `<p class="card__text">Aún no hay planes. <a href="#/viaje/${esc(ctx.trip.id)}/itinerario">Añade el primero</a>.</p>`;
  return `<ul class="upcoming">${list.map((activity) => `
    <li class="upcoming__item">
      <figure class="upcoming__thumb">${activity.image_url ? pictureHtml(activity.image_thumb || activity.image_url, { alt: '', width: 104, height: 104 }) : icon('pin')}</figure>
      <div class="upcoming__body">
        <p class="upcoming__title">${esc(activity.title)}</p>
        <p class="upcoming__when">${activity.day ? esc(formatDay(activity.day, { weekday: 'short', day: 'numeric', month: 'short' })) : 'Sin día'}${activity.time ? ` · ${esc(activity.time)}` : ''}</p>
      </div>
    </li>`).join('')}</ul>`;
}

function currencyOptions(selected) {
  return CURRENCIES.map((code) => `<option ${code === selected ? 'selected' : ''}>${code}</option>`).join('');
}

function convert(root) {
  const form = root.querySelector('[data-converter]');
  const output = root.querySelector('#converterResult');
  if (!form || !output || !rateTable) return;
  const amount = Number(form.elements.amount.value) || 0;
  const from = form.elements.from.value;
  const to = form.elements.to.value;
  const value = amount * (rateTable[to] / rateTable[from]);
  output.textContent = Number.isFinite(value) ? formatMoney(value, to) : '—';
}

async function loadRates(root) {
  const output = root.querySelector('#converterResult');
  try {
    rateTable = await rates('USD');
    convert(root);
  } catch {
    if (output) output.textContent = 'Sin conexión para las divisas.';
  }
}

const MAX_WEATHER_DAYS = 21;

/*
 * Punto de cada dia: la ciudad donde ocurren la mayoria de sus actividades
 * (en un dia de carretera la primera actividad es la salida, no el destino) o, si no hay, el destino del viaje.
 */
function weatherPoints(ctx) {
  const days = eachDay(ctx.trip.start_date, ctx.trip.end_date).slice(0, MAX_WEATHER_DAYS);
  const located = sortActivities(tripActivities).filter((activity) => activity.lat != null && activity.day);
  return days.map((day) => {
    const ofDay = located.filter((activity) => activity.day === day);
    if (!ofDay.length) return { day, lat: ctx.trip.lat, lon: ctx.trip.lon };
    const groups = new Map();
    for (const activity of ofDay) {
      const key = nearestCityName(activity.lat, activity.lon, 60) || `${activity.lat.toFixed(1)},${activity.lon.toFixed(1)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(activity);
    }
    const [, main] = [...groups.entries()].sort((first, second) => second[1].length - first[1].length)[0];
    return { day, lat: main[0].lat, lon: main[0].lon };
  }).filter((point) => point.lat != null);
}

function weatherDayHtml(day, point) {
  const info = weatherInfo(day.code);
  const city = point ? nearestCityName(point.lat, point.lon) : '';
  return `<li class="weather__day ${day.isForecast ? '' : 'weather__day--typical'}" title="${esc(info.label)}${day.isForecast ? '' : ' (clima típico)'}">
    <span class="weather__date">${esc(formatDay(day.day, { weekday: 'short', day: 'numeric' }))}</span>
    <span class="weather__icon" aria-hidden="true">${info.emoji}</span>
    <span class="visually-hidden">${esc(info.label)}${day.isForecast ? '' : ', clima típico'}</span>
    <span class="weather__temp">${day.max}° / ${day.min}°</span>
    ${city ? `<span class="weather__place">${esc(city)}</span>` : ''}
  </li>`;
}

async function loadWeather(ctx, root) {
  const box = root.querySelector('#weatherBox');
  const hint = root.querySelector('#weatherHint');
  if (!box) return;
  if (ctx.trip.lat == null) {
    box.innerHTML = '<p class="card__text">Añade un destino al viaje para ver el clima.</p>';
    return;
  }
  try {
    const isUpcoming = ctx.trip.end_date && ctx.trip.end_date >= today();
    const points = isUpcoming ? weatherPoints(ctx) : [];
    // Viaje sin fechas o ya pasado: los proximos 7 dias en el destino
    if (!points.length) {
      const days = await forecast(ctx.trip.lat, ctx.trip.lon);
      box.innerHTML = `<ul class="weather">${days.map((day) => weatherDayHtml({ ...day, isForecast: true })).join('')}</ul>`;
      if (hint) hint.textContent = 'Próximos 7 días';
      return;
    }
    const days = await tripWeather(points);
    const pointByDay = new Map(points.map((point) => [point.day, point]));
    const hasTypical = days.some((day) => !day.isForecast);
    const hasForecast = days.some((day) => day.isForecast);
    box.innerHTML = `
      <ul class="weather">${days.map((day) => weatherDayHtml(day, pointByDay.get(day.day))).join('')}</ul>
      ${hasTypical ? `<p class="weather__note">${hasForecast ? 'Los días en gris aún no tienen pronóstico: muestran' : 'Aún falta para el pronóstico: se muestra'} el clima típico de esas fechas (promedio de los últimos 3 años). Se actualiza solo al acercarse el viaje.</p>` : ''}`;
    if (hint) hint.textContent = hasTypical && !hasForecast ? 'Clima típico' : 'Días del viaje';
  } catch {
    box.innerHTML = '<p class="card__text">No se pudo cargar el clima ahora mismo.</p>';
  }
}

/* ---- Handlers ---- */

function swapCurrencyHandler(button) {
  const form = button.closest('[data-converter]');
  const from = form.elements.from;
  const to = form.elements.to;
  [from.value, to.value] = [to.value, from.value];
  button.classList.toggle('converter__swap--turned');
  convert(form.closest('section'));
}

function converterInputHandler(element) {
  if (element.name === 'to') localStorage.setItem(HOME_CURRENCY_KEY, element.value);
  convert(element.closest('section'));
}

async function copyPublicLinkHandler(button, event, ctx) {
  try {
    const token = ctx.trip.public_token || await store.setPublic(ctx.trip.id, true);
    const url = `${location.origin}${location.pathname}#/publico/${token}`;
    await navigator.clipboard.writeText(url).catch(() => null);
    if (navigator.share) navigator.share({ title: ctx.trip.name, url }).catch(() => null);
    toast('Enlace público copiado');
    ctx.reloadTrip();
  } catch (error) {
    toastError(error);
  }
}

export default {
  async render(ctx) {
    const [activities, photos, proposals] = await Promise.all([
      store.list('activities', ctx.tripId),
      store.list('photos', ctx.tripId),
      store.list('proposals', ctx.tripId)
    ]);
    tripActivities = activities;
    const status = tripStatus(ctx.trip);
    const openProposals = proposals.filter((proposal) => proposal.status === 'open').length;
    const quickLinks = SECTIONS.filter((section) => section.key !== 'resumen');
    const from = ctx.trip.currency || 'USD';
    return `
      <h2 class="visually-hidden">Resumen del viaje</h2>
      <div class="info-row">
        ${infoItem('clock', 'Estado', status.label)}
        ${infoItem('calendar', 'Planes', `${activities.length} actividades`)}
        ${infoItem('image', 'Álbum', `${photos.length} fotos`)}
        ${infoItem('vote', 'Votaciones', `${openProposals} abiertas`)}
      </div>

      <section class="section" aria-labelledby="exploreTitle">
        <div class="section__head"><h2 id="exploreTitle">Explorar</h2></div>
        <ul class="chips">
          ${quickLinks.map((section) => `<li><a class="chip" href="#/viaje/${esc(ctx.trip.id)}/${section.key}"><span class="chip__icon">${icon(section.icon, 18)}</span>${section.label}</a></li>`).join('')}
        </ul>
      </section>

      <div class="grid grid--2 section">
        <section class="card" aria-labelledby="nextTitle">
          <div class="section__head">
            <h2 id="nextTitle">Próximos planes</h2>
            <a class="link-btn" href="#/viaje/${esc(ctx.trip.id)}/itinerario">Ver todo ${icon('next', 16)}</a>
          </div>
          ${upcomingHtml(ctx, activities)}
        </section>
        <section class="card" aria-labelledby="weatherTitle">
          <div class="section__head">
            <h2 id="weatherTitle">Clima del viaje</h2>
            <span class="section__hint" id="weatherHint">Cargando…</span>
          </div>
          <div id="weatherBox"><p class="card__text">Cargando clima…</p></div>
        </section>
        <section class="card" aria-labelledby="moneyTitle">
          <h2 class="card__title" id="moneyTitle">Conversor de moneda</h2>
          <form class="converter" data-converter data-form="convert">
            <div class="form__field converter__amount">
              <label class="form__label" for="convAmount">Cantidad</label>
              <input class="form__input" id="convAmount" name="amount" type="number" min="0" step="any" value="100" inputmode="decimal" data-input="convert">
            </div>
            <div class="form__field">
              <label class="form__label" for="convFrom">De</label>
              <select class="form__select" id="convFrom" name="from" data-input="convert">${currencyOptions(from)}</select>
            </div>
            <button class="converter__swap" type="button" data-action="swap-currency" aria-label="Intercambiar monedas" title="Intercambiar monedas">${icon('swap', 20)}</button>
            <div class="form__field">
              <label class="form__label" for="convTo">A</label>
              <select class="form__select" id="convTo" name="to" data-input="convert">${currencyOptions(homeCurrency())}</select>
            </div>
            <output class="converter__result" id="converterResult" for="convAmount convFrom convTo">…</output>
          </form>
        </section>
        <section class="card" aria-labelledby="shareTitle">
          <h2 class="card__title" id="shareTitle">Compartir y exportar</h2>
          <p class="card__text">Comparte una página de solo lectura con el itinerario y el álbum, o guarda el itinerario en PDF.</p>
          <div class="page-head__actions page-head__actions--top">
            ${ctx.isOwner ? `<button class="btn btn--primary" type="button" data-action="copy-public-link">${icon('share', 18)} ${ctx.trip.public_token ? 'Copiar enlace público' : 'Crear enlace público'}</button>` : ''}
            <button class="btn" type="button" data-action="print-trip">${icon('print', 18)} Exportar PDF</button>
          </div>
          ${ctx.trip.public_token ? `<p class="form__help form__help--top">La página pública está activa. Puedes desactivarla en Grupo.</p>` : ''}
        </section>
      </div>`;
  },
  mount(ctx, root) {
    loadWeather(ctx, root);
    loadRates(root);
  },
  actions: { 'copy-public-link': copyPublicLinkHandler, 'swap-currency': swapCurrencyHandler },
  inputs: { convert: converterInputHandler }
};
