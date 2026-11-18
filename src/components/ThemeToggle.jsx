/* Boton de la cabecera: cambia entre modo claro y oscuro (en Perfil tambien se puede volver a "Automatico") */
import { useEffect, useState } from 'react';
import { effectiveTheme, onThemeChange, setThemeChoice } from '../lib/theme.js';
import { t } from '../lib/i18n/index.js';
import Icon from './Icon.jsx';

export function useTheme() {
  const [theme, setTheme] = useState(effectiveTheme);
  useEffect(() => onThemeChange(() => setTheme(effectiveTheme())), []);
  return theme;
}

export default function ThemeToggle() {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? t('Cambiar a modo claro') : t('Cambiar a modo oscuro');
  return (
    <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={() => setThemeChoice(isDark ? 'light' : 'dark')}>
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
