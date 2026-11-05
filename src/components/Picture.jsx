/*
 * <picture> con <source> WebP e <img> de respaldo (igual que pictureHtml()).
 * Las URL "local:" (modo local, IndexedDB) se resuelven al montar, como hacia hydrateMedia().
 */
import { useEffect, useState } from 'react';
import { store } from '../lib/store/index.js';

function variants(url) {
  if (url?.includes('res.cloudinary.com')) {
    return { webp: url.replace('f_auto', 'f_webp'), fallback: url.replace('f_auto', 'f_jpg') };
  }
  return { webp: url, fallback: url };
}

export default function Picture({ url, alt = '', className = '', isLazy = true, width = 640, height = 480 }) {
  const isLocal = Boolean(url?.startsWith('local:'));
  const [resolved, setResolved] = useState(isLocal ? '' : url);

  useEffect(() => {
    let isCurrent = true;
    if (!url) return undefined;
    if (!isLocal) {
      setResolved(url);
      return undefined;
    }
    store.fileUrl('photos', url).then((value) => {
      if (isCurrent) setResolved(value);
    }).catch(() => null);
    return () => {
      isCurrent = false;
    };
  }, [url, isLocal]);

  if (!url) return null;
  const { webp, fallback } = isLocal ? { webp: resolved, fallback: resolved } : variants(url);
  return (
    <picture className={className}>
      <source srcSet={webp || undefined} type="image/webp" />
      <img src={fallback || undefined} alt={alt} width={width} height={height} loading={isLazy ? 'lazy' : undefined} decoding="async" />
    </picture>
  );
}
