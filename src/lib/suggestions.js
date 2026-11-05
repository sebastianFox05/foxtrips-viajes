/*
 * Proveedores de sugerencias para <SuggestInput>. Incluidos: "city" (ciudades y codigos) y "place" (lugares).
 * Cada vista puede registrar los suyos con registerSuggestions() (viajes, frases…).
 * provider(texto, { near, signal }) → [{ name, detail?, value, lat?, lon?, code?, href?, icon? }]
 */
import { suggestCities, suggestPlaces } from './places.js';

const providers = {
  city: (query, options) => suggestCities(query, options),
  place: (query, options) => suggestPlaces(query, options)
};
const minLengths = { city: 2, place: 3 };
const labels = { city: 'Ciudades sugeridas', place: 'Lugares sugeridos' };

export const SUGGEST_ICONS = { city: 'pin', place: 'compass' };

export function registerSuggestions(kind, provider, { minLength = 1, label } = {}) {
  providers[kind] = provider;
  minLengths[kind] = minLength;
  if (label) labels[kind] = label;
}

export function suggestionProvider(kind) {
  return providers[kind];
}

export function suggestionMinLength(kind) {
  return minLengths[kind] ?? 1;
}

export function suggestionLabel(kind) {
  return labels[kind] || 'Sugerencias';
}
