/**
 * Tiny translation layer. The English text is the key: t('Add product').
 * A missing translation falls back to English, so nothing ever shows blank.
 * Translations live in ./translations.js; a language without an entry there
 * (Telugu, Kannada, Malayalam for now) shows English screens while the
 * assistant, chat and voice still work in that language.
 */
import TRANSLATIONS from './translations';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'tanglish', label: 'Tanglish' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
];

const KEY = 'smb_lang';

export function getLang() {
  try {
    return localStorage.getItem(KEY) || JSON.parse(localStorage.getItem('technova_session') || 'null')?.language || 'en';
  } catch {
    return 'en';
  }
}

/** Switch the screen language now; App re-renders on the "smb:lang" event. */
export function setLang(code) {
  try { localStorage.setItem(KEY, code); } catch { /* private mode — still switch for this visit */ }
  document.documentElement.lang = code === 'tanglish' ? 'en' : code;
  window.dispatchEvent(new Event('smb:lang'));
}

export function hasChosenLang() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function t(text, vars) {
  const lang = getLang();
  let out = TRANSLATIONS[lang]?.[text] ?? text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}
