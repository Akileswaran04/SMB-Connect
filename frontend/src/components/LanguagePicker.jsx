/** Language switch shown on every app. Changes the screen at once and, when logged in, saves it to the account. */
import { useState } from 'react';
import { LANGUAGES, getLang, setLang, t } from '../i18n';
import { setLanguage } from '../services/smb';
import { getSession, updateSessionLanguage } from '../services/storage';
import { Icon } from './ui';

export default function LanguagePicker({ className = '' }) {
  const [lang, setLocal] = useState(getLang());
  const change = (code) => {
    setLocal(code);
    setLang(code);
    if (getSession()?.token) {
      updateSessionLanguage(code);
      setLanguage(code).catch(() => {});
    }
  };
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <Icon name="translate" size={18} className="absolute left-2.5 text-on-surface-variant pointer-events-none" />
      <span className="sr-only">{t('Language')}</span>
      <select value={lang} onChange={(e) => change(e.target.value)}
        className="h-10 pl-8 pr-2 rounded-lg border border-outline-variant bg-surface text-label-md text-on-surface max-w-[11rem]">
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}
