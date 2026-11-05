/*
 * Fotos: compresion en el navegador, subida (Cloudinary, Supabase Storage o local)
 * y pintado con <picture> + <source>.
 */
import { config } from './config.js';
import { store } from './store/index.js';
import { esc, uid } from './utils.js';

const FULL_SIDE = 2048;
const THUMB_SIDE = 640;
const QUALITY = 0.82;
const DELETE_ENDPOINT = '/api/borrar-foto';
const hasCloudinary = Boolean(config.cloudinaryCloudName && config.cloudinaryUploadPreset);

export const photoProvider = hasCloudinary ? 'cloudinary' : store.mode === 'cloud' ? 'supabase' : 'local';

/* ---- Compresion ---- */

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* se usa el plan B */
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  URL.revokeObjectURL(url);
  return image;
}

function canvasBlob(canvas, type) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

async function resize(bitmap, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const webp = await canvasBlob(canvas, 'image/webp');
  // Safari antiguo no codifica WebP y devuelve PNG: entonces se usa JPEG
  if (webp?.type === 'image/webp') return webp;
  return canvasBlob(canvas, 'image/jpeg');
}

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  const bitmap = await loadBitmap(file);
  const [full, thumb] = await Promise.all([resize(bitmap, FULL_SIDE), resize(bitmap, THUMB_SIDE)]);
  return { full, thumb };
}

/* ---- Subida ---- */

function cloudinaryTransform(url, transform) {
  return url.replace('/upload/', `/upload/${transform}/`);
}

async function uploadToCloudinary(tripId, blob) {
  const body = new FormData();
  body.append('file', blob);
  body.append('upload_preset', config.cloudinaryUploadPreset);
  body.append('folder', `foxtrips/${tripId}`);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`, { method: 'POST', body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'No se pudo subir la foto a Cloudinary.');
  return {
    url: cloudinaryTransform(data.secure_url, 'q_auto,f_auto,w_2048,c_limit'),
    thumb_url: cloudinaryTransform(data.secure_url, 'q_auto,f_auto,w_640,h_640,c_fill,g_auto'),
    storage_path: data.public_id,
    provider: 'cloudinary'
  };
}

export async function uploadPhoto(tripId, file) {
  const { full, thumb } = await compressImage(file);
  if (hasCloudinary) return uploadToCloudinary(tripId, full);
  const extension = full.type === 'image/webp' ? 'webp' : 'jpg';
  const name = uid();
  const [fullFile, thumbFile] = await Promise.all([
    store.uploadFile('photos', `${tripId}/${name}.${extension}`, full),
    store.uploadFile('photos', `${tripId}/${name}-thumb.${extension}`, thumb)
  ]);
  return { url: fullFile.url, thumb_url: thumbFile.url, storage_path: fullFile.path, provider: photoProvider };
}

/*
 * Cloudinary no permite borrar desde el navegador sin firma: lo hace la funcion de Netlify
 * netlify/functions/borrar-foto.mjs. Hay que llamarla ANTES de borrar la fila (la funcion la comprueba).
 * Si la funcion no esta disponible (en local, o sin claves en Netlify), la foto solo se quita del album.
 */
async function callDeleteEndpoint(payload) {
  const token = await store.accessToken?.();
  if (!token) return;
  await fetch(DELETE_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function deleteCloudinaryFile(photo) {
  return callDeleteEndpoint({ photoId: photo.id });
}

/* Al eliminar un viaje: borra su carpeta foxtrips/<viaje>/ en Cloudinary (solo la persona organizadora) */
export async function deleteTripFiles(tripId) {
  if (hasCloudinary) await callDeleteEndpoint({ tripId });
}

export async function deletePhotoFile(photo) {
  if (photo.provider === 'cloudinary') {
    await deleteCloudinaryFile(photo);
    return;
  }
  await store.removeFile('photos', photo.storage_path);
  await store.removeFile('photos', photo.storage_path?.replace(/(\.\w+)$/, '-thumb$1'));
}

/* ---- Pintado ---- */

function variants(url) {
  if (url?.includes('res.cloudinary.com')) {
    return { webp: url.replace('f_auto', 'f_webp'), fallback: url.replace('f_auto', 'f_jpg') };
  }
  return { webp: url, fallback: url };
}

/*
 * Devuelve <picture> con <source> WebP e <img> de respaldo.
 * Las URLs "local:" se resuelven despues con hydrateMedia().
 */
export function pictureHtml(url, { alt = '', className = '', isLazy = true, width = 640, height = 480 } = {}) {
  if (!url) return '';
  const { webp, fallback } = variants(url);
  const isLocal = url.startsWith('local:');
  const srcAttr = isLocal ? `data-media-src="${esc(fallback)}"` : `src="${esc(fallback)}"`;
  const srcsetAttr = isLocal ? `data-media-srcset="${esc(webp)}"` : `srcset="${esc(webp)}"`;
  return `<picture class="${className}"><source ${srcsetAttr} type="image/webp"><img ${srcAttr} alt="${esc(alt)}" width="${width}" height="${height}" ${isLazy ? 'loading="lazy"' : ''} decoding="async"></picture>`;
}

export async function hydrateMedia(root = document) {
  const pending = root.querySelectorAll('[data-media-src], [data-media-srcset]');
  await Promise.all(Array.from(pending, async (element) => {
    if (element.dataset.mediaSrc) {
      element.src = await store.fileUrl('photos', element.dataset.mediaSrc);
      delete element.dataset.mediaSrc;
    }
    if (element.dataset.mediaSrcset) {
      element.srcset = await store.fileUrl('photos', element.dataset.mediaSrcset);
      delete element.dataset.mediaSrcset;
    }
  }));
}

export async function resolveUrl(url) {
  return store.fileUrl('photos', url);
}
