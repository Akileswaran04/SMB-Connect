/**
 * Floating "Help" — call or WhatsApp a real person. Numbers come from
 * VITE_SUPPORT_PHONE / VITE_SUPPORT_WHATSAPP; with neither set it hides.
 */
import { useState } from 'react';
import { Icon } from './ui';
import { t } from '../i18n';

const PHONE = import.meta.env.VITE_SUPPORT_PHONE;
const WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP;

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  if (!PHONE && !WHATSAPP) return null;
  const link = 'flex items-center gap-3 px-4 h-12 rounded-lg hover:bg-surface-container text-body-md text-on-surface';
  return (
    <div className="fixed right-4 bottom-20 lg:bottom-6 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl p-2 w-60">
          <p className="px-4 py-2 text-label-md text-on-surface-variant">{t('Need help? Talk to us.')}</p>
          {PHONE && <a href={`tel:${PHONE}`} className={link}><Icon name="call" className="text-primary" />{t('Call us')}</a>}
          {WHATSAPP && <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" className={link}><Icon name="chat" className="text-primary" />{t('WhatsApp us')}</a>}
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="h-12 px-4 rounded-full bg-inverse-surface text-inverse-on-surface shadow-lg flex items-center gap-2 text-label-md font-semibold">
        <Icon name={open ? 'close' : 'support_agent'} />{t('Help')}
      </button>
    </div>
  );
}
