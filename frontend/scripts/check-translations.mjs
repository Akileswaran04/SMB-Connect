// Fails if a screen string has no Hindi/Tamil translation, or a translation
// drops or invents a {placeholder}. Run: node scripts/check-translations.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f) && !p.endsWith('translations.js')) files.push(p);
  }
}(ROOT));

// Strings shown through t(): direct t('…') calls, plus the tables and
// messages that are passed to t() through a variable.
const keys = new Set();
const direct = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const tables = /(?:label|note|hint|title|tag|hint|done)\s*:\s*'((?:\\.|[^'])*)'/g;
const runMsg = /\brun\([\s\S]{0,400}?,\s*'([^']+)'(?:,\s*\w+(?:\.id)?)?\)/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(direct)) keys.add(m[2].replace(/\\(['"])/g, '$1'));
  if (/\bt\((?:x|l|r|s|o|m|a|tab|pm)\.label|\bt\(step\.|\bt\(STATE|\bt\(TITLES|t\(mood\.label/.test(s)) {
    for (const m of s.matchAll(tables)) keys.add(m[1].replace(/\\(['"])/g, '$1'));
  }
  for (const m of s.matchAll(runMsg)) if (!['error', 'success'].includes(m[1])) keys.add(m[1]);
}
// Constant lists rendered with t(): reasons, statuses, quick replies, categories.
const fmt = readFileSync(join(ROOT, 'utils/format.js'), 'utf8');
const listed = [
  ...fmt.slice(fmt.indexOf('const STATUS_TEXT')).matchAll(/:\s*'([^']+)'|"([^"]+)"|\['(?:[a-z_]+)',\s*(?:'([^']+)'|"([^"]+)")\]|'([A-Z][^']+)'/g),
].map((m) => m[1] || m[2] || m[3] || m[4] || m[5]).filter((v) => v && /[A-Z ]/.test(v) && !/^[a-z_]+$/.test(v));
listed.forEach((v) => keys.add(v));
for (const [file, name] of [['components/OnboardingForm.jsx', 'CATEGORIES'], ['modules/unified-inbox/components/ChatView.jsx', 'QUICK_REPLIES'],
  ['modules/buyer/components/AssistantPage.jsx', 'SUGGESTIONS'], ['components/AddressForm.jsx', 'LABELS'], ['utils/api.js', 'BY_STATUS'],
  ['modules/seller/ProfileTab.jsx', 'VERIFY_NOTE'], ['modules/buyer/components/CataloguePage.jsx', 'FILTER_NAMES']]) {
  const s = readFileSync(join(ROOT, file), 'utf8');
  const block = s.slice(s.indexOf(`const ${name}`), s.indexOf(';', s.indexOf(`const ${name}`)));
  for (const m of block.matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)) {
    const v = m[2].replace(/\\(['"])/g, '$1');
    if (/[A-Z]/.test(v[0]) || v.includes(' ')) keys.add(v);
  }
}

const { default: T } = await import(new URL('../src/translations.js', import.meta.url));
const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
let bad = 0;
for (const k of [...keys].sort()) {
  if (!/[a-zA-Z]/.test(k) || /^(https?:|data:|text-|bg-)/.test(k)) continue;
  for (const lang of ['hi', 'ta']) {
    const v = T[lang][k];
    if (v === undefined) { console.log(`missing ${lang}: ${JSON.stringify(k)}`); bad++; }
    else if (ph(v) !== ph(k)) { console.log(`placeholder mismatch ${lang}: ${JSON.stringify(k)} -> ${JSON.stringify(v)}`); bad++; }
  }
}
console.log(`${keys.size} strings checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
