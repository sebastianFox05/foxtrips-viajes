# SKILLS.md — Rubrica del proyecto FoxTrips

Criterios que deben cumplir HTML, CSS y Javascript. El agente Review valida contra este archivo.
Desde la version 2 (noviembre de 2026) la app esta hecha con **React + Vite** (JavaScript, sin TypeScript).

## Estructura de carpetas y archivos

- Nombres en minusculas, sin espacios ni tildes, separados por guiones (los componentes React en PascalCase: `TripForm.jsx`).
- `index.html` en la raiz (solo `<div id="root">`); codigo en `src/`; imagenes y manifiesto en `public/`.
- `src/lib/` logica sin pantalla (almacen, servicios, datos); `src/components/` piezas reutilizables;
  `src/views/` una vista por pantalla o pestaña; `src/ui/` y `src/session/` contextos globales.
- `supabase/schema.sql` contiene la base de datos y sus politicas de seguridad.

## HTML (agente Timmy)

- Documento con `lang="es"`, `meta charset`, `meta viewport`, `title` y `meta description` (SEO).
- Estructura semantica: `header`, `nav`, `main`, `section`, `article`, `figure`, `footer`.
- Un unico `h1` por vista y jerarquia de titulos sin saltos.
- Imagenes con `picture` + `source` (componente `<Picture>`) e `img` con `alt` descriptivo, `width`/`height` o `aspect-ratio`, y `loading="lazy"` fuera de la primera pantalla.
- Formularios con `label` asociado a cada campo (`htmlFor`).
- Enlaces y botones con texto o `aria-label` comprensible.

## CSS (agente Timmy)

- Metodologia BEM: `bloque`, `bloque__elemento`, `bloque--modificador` (en `className`).
- Archivo `src/styles/styles.css` comentado por bloques; los componentes reutilizan esas clases (sin CSS-in-JS).
- Variables de diseño en `:root`, con modo oscuro via `prefers-color-scheme`.
- Mobile first: media queries con `min-width`.
- Sin scroll horizontal en la pagina (las tiras de pestañas hacen scroll dentro de su contenedor).
- Sin alturas rigidas que recorten contenido; usar `min-height` y `aspect-ratio`.
- Foco visible (`:focus-visible`) y contraste AA.
- Respeta `prefers-reduced-motion`.

## Javascript / React (agente Javascript)

- Componentes de funcion con hooks; un componente principal por archivo.
- Los eventos van en el propio componente (`onClick`, `onSubmit`, `onChange`): es la forma de React y sustituye a la
  delegacion por `data-action` de la version 1. Nada de `addEventListener` sobre nodos que pinta React salvo en `useEffect` con limpieza.
- Orden en cada modulo: imports, constantes, variables de modulo, funciones/componentes auxiliares y, al final, el componente exportado.
- Nomenclatura camelCase; handlers con sufijo `Handler`; booleanos con prefijo `is`/`has`.
- React escapa el texto: **prohibido `dangerouslySetInnerHTML`** salvo para los SVG constantes de `icons.js`.
  Los enlaces externos pasan por `safeUrl()` y llevan `rel="noopener noreferrer"`.
- Datos remotos con `useLoad()` (descarta respuestas viejas) y refresco por `refreshKey` del `TripContext`.
- Modales con `<dialog>` (`UiContext`): cierre con `Escape`, foco al primer campo y foco restaurado al cerrar.
- Lightbox (`LightboxContext`): cierre con `Escape`, navegacion con flechas izquierda/derecha y foco restaurado al cerrar.
- Dependencias con version exacta en `package.json` y `package-lock.json`; `npm audit --omit=dev` sin avisos.

## Seguridad

- Nunca en el codigo: la clave secreta de Supabase ni el API Secret de Cloudinary (solo en variables de entorno de Netlify).
- Content-Security-Policy y cabeceras en `netlify.toml`: si la app empieza a usar un servicio nuevo, añadir su origen alli.
- Las comprobaciones de permisos viven en la base de datos (RLS) y en la funcion de Netlify, no solo en la interfaz.
