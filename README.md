# FoxTrips · App de viajes en grupo

- **App (principal):** https://foxtrips-viajes.netlify.app
- **Copia en GitHub Pages:** https://sebastianfox05.github.io/foxtrips-viajes/
  (sin la función de borrado de fotos en Cloudinary ni las cabeceras de Netlify; se publica sola con cada subida a `main`)
- **Código:** https://github.com/sebastianFox05/foxtrips-viajes

App web responsive (HTML + CSS + JS, sin compilación) para planear viajes en grupo. Cada viaje tiene:
itinerario (en carrete o en lista), mapa, álbum, votaciones, diario con resumen final, equipaje, documentos,
grupo con invitaciones, historial, clima, conversor de moneda, exportación a PDF, página pública y
**frases útiles en inglés de EE. UU.** (12 situaciones, con pronunciación, voz y favoritas) y
**recomendaciones**: el top 5 de lo más visitado según el destino, la ciudad donde estás (ubicación del navegador) o
cualquier ciudad que busques. Los carretes y las tiras de opciones tienen flechas para usarlos sin pantalla táctil.
Cada plan del itinerario tiene un botón **Historia**: busca el lugar en Wikipedia (`assets/js/place-history.js`) y muestra
por qué es famoso y un resumen de su historia, con enlace al artículo. Si no encuentra un artículo parecido, no muestra nada.

Antes de entrar se muestra una **bienvenida** con fotos de viaje (se puede saltar) y después la pantalla de **acceso o registro**.

Para verla llena de contenido, pulsa **"Ver ejemplo: Nueva York"** en el inicio: crea un viaje de 5 días con fotos
libres de Wikimedia Commons (cada foto muestra su autor y licencia).

## 1. Probarla ya (modo local)

Está hecha con **React + Vite**. Necesitas Node.js 20 o más nuevo:

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Para probar la versión compilada (con la misma política de seguridad que Netlify):
`npm run build` y luego `npm run preview`.
Sin claves en `src/lib/config.js`, todo se guarda **solo en ese navegador**.
Para simular a otra persona, cierra sesión en Perfil y entra con otro nombre.

## 2. Modo nube: varias personas y varios dispositivos

### Supabase (datos, cuentas, tiempo real y documentos), gratis sin tarjeta
1. Crea un proyecto en https://supabase.com.
2. Ve a **SQL Editor → New query**, pega `supabase/schema.sql` entero y pulsa **Run**.
3. Ve a **Project Settings → API** y copia la *Project URL* y la clave *publishable* en `src/lib/config.js`.
4. En **Authentication → URL Configuration** pon tu dirección (por ejemplo `http://localhost:5173` o la de Netlify) como *Site URL*.
5. Opcional: en **Authentication → Providers → Email** desactiva *Confirm email* para que las cuentas funcionen al momento.
6. Opcional, para el botón **Continuar con Google**: en **Authentication → Providers → Google** actívalo y pega el *Client ID* y *Client secret* de Google Cloud (OAuth). Sin esto, el botón mostrará un error.

### Cloudinary (fotos, unos 25 GB gratis)
1. Crea una cuenta en https://cloudinary.com.
2. Copia el **Cloud name** del Dashboard.
3. Ve a **Settings → Upload → Upload presets → Add upload preset**, elige *Signing mode: Unsigned* y guarda.
4. Pon el *cloud name* y el nombre del preset en `src/lib/config.js`.

Si no configuras Cloudinary, las fotos se guardan en Supabase Storage (1 GB en el plan gratis).
Las fotos se comprimen en el navegador (máximo 2048 px, WebP) antes de subirse, unos 300–500 KB por foto.

> Al borrar una foto del álbum, la función de Netlify `netlify/functions/borrar-foto.mjs` borra también el archivo en Cloudinary.
> Al eliminar un viaje, la misma función borra toda su carpeta `foxtrips/<viaje>/`. Esto solo lo puede hacer quien organiza el viaje.
> Para eso necesita dos variables de entorno en Netlify → *Project configuration → Environment variables*:
> `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` (Cloudinary → *Settings → API Keys*). Ponlas tú: el secreto nunca va en el código.
> Sin ellas (o en local) la foto solo se quita del álbum y el archivo queda en Cloudinary → Media Library.

## 3. Publicada en Netlify

La app está en **https://foxtrips-viajes.netlify.app** (proyecto `foxtrips-viajes` en Netlify).
`netlify.toml` instala las dependencias (`npm ci`), compila con Vite y publica solo `dist/`: el código fuente, los documentos internos y el SQL no se suben. También define la Content-Security-Policy y las demás cabeceras de seguridad.
Además despliega la función `POST /api/borrar-foto` (carpeta `netlify/functions/`).

En Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://foxtrips-viajes.netlify.app`
- **Redirect URLs:** `https://foxtrips-viajes.netlify.app/**` y, para probar en local, `http://localhost:5173/**`

Para publicar cambios, pídeselo a Claude o usa `netlify deploy --prod` desde esta carpeta.

## Idiomas y región

- **Idioma de la app**: español, inglés y portugués. Se elige solo según el dispositivo y se cambia en Perfil → «Idioma y región» (o en la pantalla de acceso).
- **Cómo se traduce**: los textos del código están en español y se envuelven en `t('…')` (`src/lib/i18n/index.js`). Las traducciones viven en `src/lib/i18n/en.js` y `pt.js`. `npm run i18n` avisa de los textos que falten. Para añadir un idioma: un archivo nuevo con las mismas claves y una línea en `LANGUAGES` y `DICTIONARIES`.
- **Formatos regionales** (`src/lib/locale.js`): hora de 12 o 24 h, °C o °F, km o millas y moneda de casa, automáticos según la región y editables en Perfil. La lista de monedas cubre todos los países (`src/lib/currencies.js`); al elegir el destino de un viaje se propone su moneda.
- **Zona horaria**: las horas de los planes son siempre las del destino. El resumen muestra la hora actual allí y el itinerario avisa de la diferencia con tu hora (`src/lib/destination.js`).
- **Frases**: 95 frases en inglés, español, portugués, francés, italiano, alemán y japonés (`src/lib/phrases.js`). Se muestran en el idioma del país del destino y se explican en el idioma de la app.
- El historial guarda cada cambio escrito en el idioma de quien lo hizo.

## Roles

| Rol | Puede |
|---|---|
| Organizador | Todo, incluido cambiar roles y borrar el viaje |
| Editor | Editar itinerario, fotos, diario, documentos y equipaje común |
| Lector | Ver, comentar, votar, proponer y llevar su maleta personal |

## Estructura

```
viajes/
├── index.html              Punto de entrada (solo <div id="root">)
├── vite.config.js          Vite + React + PWA (el service worker se genera al compilar)
├── package.json            Dependencias con versión exacta
├── netlify.toml            Compilación, función y cabeceras de seguridad (CSP)
├── public/                 manifest.webmanifest e iconos (assets/img)
├── src/
│   ├── main.jsx            Arranque: rutas por hash, sesión, modal, visor
│   ├── App.jsx             Cabecera, rutas, barra inferior y pie
│   ├── styles/styles.css   Estilos BEM comentados por bloques
│   ├── lib/                Almacén (local / Supabase), servicios, lugares, fotos, datos…
│   ├── components/         Icon, Picture, Avatar, Scroller, SuggestInput, Comments
│   ├── ui/                 Modal, avisos y visor de fotos (contextos)
│   ├── session/            Usuario actual
│   └── views/              Una vista por pantalla y por pestaña del viaje
├── netlify/functions/      borrar-foto.mjs (borrado firmado en Cloudinary)
└── supabase/schema.sql     Tablas, RLS, funciones, tiempo real y buckets
```

Servicios externos gratuitos: OpenStreetMap/Leaflet (mapa), Nominatim (ubicaciones), Open-Meteo (clima),
ExchangeRate-API open access (divisas).
