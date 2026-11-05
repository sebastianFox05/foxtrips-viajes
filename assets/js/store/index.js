/* Elige el almacen segun config.js: Supabase si hay claves, local si no. */
import { config } from '../config.js';

const isCloud = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const backend = isCloud ? await import('./supabase.js') : await import('./local.js');

export const store = backend.default;
