/* Icono SVG en linea (mismo marcado que icon() de la version anterior). Los trazos son constantes del proyecto. */
import { iconPaths } from '../lib/icons.js';

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: iconPaths(name) }}
    />
  );
}
