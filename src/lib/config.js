/*
 * Configuracion de servicios.
 * Deja los valores vacios para usar el MODO LOCAL (los datos se guardan solo en este navegador).
 * Rellenalos siguiendo README.md para activar el modo nube (varias personas, varios dispositivos).
 */
export const config = {
  // Supabase → Project Settings → API Keys (la URL sale del Project ID)
  supabaseUrl: 'https://mbldzwyzzzizowjgzdso.supabase.co',
  // Clave publica (publishable): esta pensada para ir en el navegador; la seguridad la ponen las reglas RLS
  supabaseAnonKey: 'sb_publishable_jbrnE06EJFRnZVR-vPb39w_4fb_QSSt',

  // Cloudinary (fotos) → Dashboard → "Cloud name" y Settings → Upload → Upload preset sin firmar.
  // Si lo dejas vacio y usas Supabase, las fotos se guardan en Supabase Storage.
  cloudinaryCloudName: 'dlxcei9u',
  cloudinaryUploadPreset: 'foxtrips',

  // Avisos push: clave PUBLICA VAPID (la privada solo esta en Netlify, variable VAPID_PRIVATE_KEY).
  // Vacia = sin avisos.
  vapidPublicKey: 'BNHt0hyaCnK4UrNw9MuvYstjAeI5UjkcbJDYX4yZ1ngS9Ym-5-FBws6eRxK4-lm136UvG9PnE7-j9kpf5-us_2g'
};
