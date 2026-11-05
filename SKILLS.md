# SKILLS.md — Rubrica del proyecto FoxTrips

Criterios que deben cumplir HTML, CSS y Javascript. El agente Review valida contra este archivo.

## Estructura de carpetas y archivos

- Nombres en minusculas, sin espacios ni tildes, separados por guiones.
- `index.html` y `sw.js` en la raiz; estilos en `assets/css`; comportamiento en `assets/js`; imagenes en `assets/img`.
- `supabase/schema.sql` contiene la base de datos y sus politicas de seguridad.

## HTML (agente Timmy)

- Documento con `lang="es"`, `meta charset`, `meta viewport`, `title` y `meta description` (SEO).
- Estructura semantica: `header`, `nav`, `main`, `section`, `article`, `figure`, `footer`.
- Un unico `h1` por vista y jerarquia de titulos sin saltos.
- Imagenes con `picture` + `source` y `img` con `alt` descriptivo, `width`/`height` o `aspect-ratio`, y `loading="lazy"` fuera de la primera pantalla.
- Formularios con `label` asociado a cada campo.
- Enlaces y botones con texto o `aria-label` comprensible.

## CSS (agente Timmy)

- Metodologia BEM: `bloque`, `bloque__elemento`, `bloque--modificador`.
- Archivo comentado por bloques.
- Variables de diseño en `:root`, con modo oscuro via `prefers-color-scheme`.
- Mobile first: media queries con `min-width`.
- Sin scroll horizontal en la pagina (las tiras de pestañas hacen scroll dentro de su contenedor).
- Sin alturas rigidas que recorten contenido; usar `min-height` y `aspect-ratio`.
- Foco visible (`:focus-visible`) y contraste AA.
- Respeta `prefers-reduced-motion`.

## Javascript (agente Javascript)

- Javascript no intrusivo: ningun atributo `onclick`/`on*` en HTML; eventos con `addEventListener` y delegacion por `data-action`.
- Orden en cada modulo: constantes, variables, funciones y, al final, asignaciones de eventos.
- Nomenclatura camelCase; handlers con sufijo `Handler`; booleanos con prefijo `is`/`has`.
- Escapar todo texto del usuario antes de insertarlo en HTML.
- Modales con `dialog`: cierre con `Escape`, foco al primer campo y foco restaurado al cerrar.
- Lightbox: cierre con `Escape`, navegacion con flechas izquierda/derecha y foco restaurado al cerrar.
