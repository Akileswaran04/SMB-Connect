
import { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success', onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss?.(), 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  const style =
    type === 'success'
      ? 'bg-primary text-on-primary'
      : type === 'error'
        ? 'bg-error text-on-error'
        : 'bg-inverse-surface text-inverse-on-surface';

  const icon =
    type === 'success' ? 'check_circle' :
    type === 'error' ? 'error' : 'info';

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-label-md font-medium flex items-center gap-2 max-w-sm
        ${style} transition-all duration-300 toast-enter
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      {message}
    </div>
  );
}
