/*
 * Tema de la app: automatico (el del sistema), claro u oscuro.
 * Se guarda en este navegador y se aplica con data-theme en <html> (ver los colores al principio de styles.css).
 */
const THEME_KEY = 'foxtrips:theme';
const THEMES = ['auto', 'light', 'dark'];
const BAR_COLORS = { light: '#f4f4f2', dark: '#0c0c0d' };
const listeners = new Set();
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeChoice() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

/* Tema que se ve ahora: 'light' | 'dark' */
export function effectiveTheme(choice = getThemeChoice()) {
  if (choice !== 'auto') return choice;
  return systemDark.matches ? 'dark' : 'light';
}

export function applyTheme(choice = getThemeChoice()) {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = choice;
  // La barra del navegador y del sistema toma el color del fondo
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[effectiveTheme(choice)]);
  listeners.forEach((listener) => listener());
}

export function setThemeChoice(choice) {
  const next = THEMES.includes(choice) ? choice : 'auto';
  try {
    if (next === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
  applyTheme(next);
}

/* Avisa cuando cambia el tema (elegido o del sistema). Devuelve la funcion para dejar de escuchar */
export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Si se sigue al sistema y este cambia de claro a oscuro, se actualiza la barra
systemDark.addEventListener?.('change', () => applyTheme());
