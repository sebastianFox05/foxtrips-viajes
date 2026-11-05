# FoxTrips · App de viajes en grupo

App web responsive (HTML + CSS + JS, sin compilación) para planear viajes en grupo. Cada viaje tiene:
itinerario (en carrete o en lista), mapa, álbum, votaciones, diario con resumen final, equipaje, documentos,
grupo con invitaciones, historial, clima, conversor de moneda, exportación a PDF, página pública y
**frases útiles en inglés de EE. UU.** (12 situaciones, con pronunciación, voz y favoritas) y
**recomendaciones**: el top 5 de lo más visitado según el destino, la ciudad donde estás (ubicación del navegador) o
cualquier ciudad que busques. Los carretes y las tiras de opciones tienen flechas para usarlos sin pantalla táctil.

Antes de entrar se muestra una **bienvenida** con fotos de viaje (se puede saltar) y después la pantalla de **acceso o registro**.

Para verla llena de contenido, pulsa **"Ver ejemplo: Nueva York"** en el inicio: crea un viaje de 5 días con fotos
libres de Wikimedia Commons (cada foto muestra su autor y licencia).

## 1. Probarla ya (modo local)

Necesita un servidor local porque usa módulos ES y un service worker:

```bash
npx serve viajes -l 5173
```

Abre http://localhost:5173. Sin claves en `assets/js/config.js`, todo se guarda **solo en ese navegador**.
Para simular a otra persona, cierra sesión en Perfil y entra con otro nombre.

## 2. Modo nube: varias personas y varios dispositivos

### Supabase (datos, cuentas, tiempo real y documentos), gratis sin tarjeta
1. Crea un proyecto en https://supabase.com.
2. Ve a **SQL Editor → New query**, pega `supabase/schema.sql` entero y pulsa **Run**.
3. Ve a **Project Settings → API** y copia la *Project URL* y la clave *anon public* en `assets/js/config.js`.
4. En **Authentication → URL Configuration** pon tu dirección (por ejemplo `http://localhost:5173` o la de Netlify) como *Site URL*.
5. Opcional: en **Authentication → Providers → Email** desactiva *Confirm email* para que las cuentas funcionen al momento.
6. Opcional, para el botón **Continuar con Google**: en **Authentication → Providers → Google** actívalo y pega el *Client ID* y *Client secret* de Google Cloud (OAuth). Sin esto, el botón mostrará un error.

### Cloudinary (fotos, unos 25 GB gratis)
1. Crea una cuenta en https://cloudinary.com.
2. Copia el **Cloud name** del Dashboard.
3. Ve a **Settings → Upload → Upload presets → Add upload preset**, elige *Signing mode: Unsigned* y guarda.
4. Pon el *cloud name* y el nombre del preset en `assets/js/config.js`.

Si no configuras Cloudinary, las fotos se guardan en Supabase Storage (1 GB en el plan gratis).
Las fotos se comprimen en el navegador (máximo 2048 px, WebP) antes de subirse, unos 300–500 KB por foto.

> Al borrar una foto del álbum, la función de Netlify `netlify/functions/borrar-foto.mjs` borra también el archivo en Cloudinary.
> Para eso necesita dos variables de entorno en Netlify → *Project configuration → Environment variables*:
> `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` (Cloudinary → *Settings → API Keys*). Ponlas tú: el secreto nunca va en el código.
> Sin ellas (o en local) la foto solo se quita del álbum y el archivo queda en Cloudinary → Media Library.

## 3. Publicada en Netlify

La app está en **https://foxtrips-viajes.netlify.app** (proyecto `foxtrips-viajes` en Netlify).
`netlify.toml` publica solo la app (`index.html`, `sw.js`, `manifest.webmanifest` y `assets/`): los documentos internos y el SQL no se suben.
Además despliega la función `POST /api/borrar-foto` (carpeta `netlify/functions/`).

En Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://foxtrips-viajes.netlify.app`
- **Redirect URLs:** `https://foxtrips-viajes.netlify.app/**` y, para probar en local, `http://localhost:5173/**`

Para publicar cambios, pídeselo a Claude o usa `netlify deploy --prod` desde esta carpeta.

## Roles

| Rol | Puede |
|---|---|
| Organizador | Todo, incluido cambiar roles y borrar el viaje |
| Editor | Editar itinerario, fotos, diario, documentos y equipaje común |
| Lector | Ver, comentar, votar, proponer y llevar su maleta personal |

## Estructura

```
viajes/
├── index.html            Estructura semántica y contenedores
├── sw.js                 Service worker (PWA / sin conexión)
├── manifest.webmanifest
├── assets/css/styles.css Estilos BEM comentados por bloques
├── assets/img/           Iconos
├── assets/js/
│   ├── app.js            Enrutador y delegación de eventos
│   ├── config.js         Claves de Supabase y Cloudinary
│   ├── store/            Almacén local y almacén Supabase (misma API)
│   ├── views/            Una vista por sección
│   └── ...               media, lightbox, comentarios, servicios, ui, utils
└── supabase/schema.sql   Tablas, RLS, funciones, tiempo real y buckets
```

Servicios externos gratuitos: OpenStreetMap/Leaflet (mapa), Nominatim (ubicaciones), Open-Meteo (clima),
ExchangeRate-API open access (divisas).
