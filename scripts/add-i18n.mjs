/*
 * Añade traducciones nuevas a src/lib/i18n/<idioma>.js sin tocar las que ya hay.
 * Uso: node scripts/add-i18n.mjs nuevas.json   (JSON: { "en": { "texto": "traduccion" }, "pt": { … } })
 */
import { readFileSync, writeFileSync } from 'node:fs';

const additions = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [language, entries] of Object.entries(additions)) {
  const path = `src/lib/i18n/${language}.js`;
  const source = readFileSync(path, 'utf8');
  const { default: current } = await import(new URL(`../${path}`, import.meta.url));
  const fresh = Object.entries(entries).filter(([key]) => !(key in current));
  if (!fresh.length) continue;
  const lines = fresh.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');
  writeFileSync(path, source.replace(/\n};\s*$/, `,\n${lines}\n};\n`));
  console.log(`${language}: ${fresh.length} nuevas`);
}
