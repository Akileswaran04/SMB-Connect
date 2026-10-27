/**
 * Short message at the bottom of the screen. Success messages stay 5 seconds;
 * errors stay until the person closes them, so slower readers don't miss them.
 */
import { useEffect, useState } from 'react';
import { t } from '../../i18n';

export default function Toast({ message, type = 'success', onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return undefined;
    setVisible(true);
    if (type === 'error') return undefined;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss?.(), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, type, onDismiss]);

  if (!message) return null;

  const style = type === 'success' ? 'bg-primary text-on-primary'
    : type === 'error' ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface';
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3.5 rounded-xl shadow-lg text-body-md font-medium flex items-center gap-3 w-[calc(100%-2rem)] max-w-md
        ${style} transition-all duration-300 toast-enter ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <span className="material-symbols-outlined text-[22px]">{icon}</span>
      <span className="flex-1">{message}</span>
      <button onClick={() => { setVisible(false); onDismiss?.(); }} aria-label={t('Close')} className="p-1 -mr-1 rounded-full hover:bg-black/10">
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}
