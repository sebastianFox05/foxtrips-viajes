/*
 * Comprueba las traducciones: busca en src/ los textos marcados con t('…'), tn(n, '…', '…') y m('…')
 * y avisa de los que faltan en cada idioma (src/lib/i18n/*.js) y de los {valores} que no coinciden.
 * Uso: npm run i18n
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_DIR = 'src';
const I18N_DIR = join('src', 'lib', 'i18n');
const TEXT = "'((?:[^'\\\\\\n]|\\\\.)*)'";
const PATTERNS = [
  new RegExp(`(?<![\\w.$])(?:t|m)\\(\\s*${TEXT}`, 'g'),
  new RegExp(`(?<![\\w.$])tn\\([^,]+,\\s*${TEXT},\\s*${TEXT}`, 'g'),
  // t(condicion ? 'uno' : 'otro', …)
  new RegExp(`(?<![\\w.$])t\\([^'\\n]*\\? ${TEXT} : ${TEXT}`, 'g'),
  // t(lista[clave] || 'por defecto')
  new RegExp(`(?<![\\w.$])t\\([^'\\n]*\\|\\| ${TEXT}`, 'g')
];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === I18N_DIR ? [] : sourceFiles(path);
    return /\.(js|jsx)$/.test(name) ? [path] : [];
  });
}

const keys = new Map();
for (const file of [...sourceFiles(SOURCE_DIR), join(I18N_DIR, 'index.js')]) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      for (const text of match.slice(1)) {
        if (text === undefined) continue;
        const key = text.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        if (!keys.has(key)) keys.set(key, file);
      }
    }
  }
}

const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',');
const languages = readdirSync(I18N_DIR).filter((name) => name !== 'index.js' && name.endsWith('.js'));
let problems = 0;
for (const name of languages) {
  const { default: dictionary } = await import(new URL(`../${I18N_DIR.replaceAll('\\', '/')}/${name}`, import.meta.url));
  for (const [key, file] of keys) {
    if (!(key in dictionary)) {
      problems += 1;
      console.log(`${name}: falta "${key}" (${file})`);
    } else if (placeholders(key) !== placeholders(dictionary[key])) {
      problems += 1;
      console.log(`${name}: los {valores} no coinciden en "${key}"`);
    }
  }
  const unused = Object.keys(dictionary).filter((key) => !keys.has(key));
  if (unused.length) console.log(`${name}: ${unused.length} textos ya no se usan: ${unused.slice(0, 5).map((key) => `"${key}"`).join(', ')}${unused.length > 5 ? '…' : ''}`);
}
console.log(`${keys.size} textos, ${languages.length} idiomas, ${problems} problemas`);
process.exit(problems ? 1 : 0);
