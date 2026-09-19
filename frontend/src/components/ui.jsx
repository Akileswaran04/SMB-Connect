/**
 * Small shared UI kit so every role's app looks and behaves the same:
 * buttons, cards, badges, tabs, modals, fields, stats and empty/loading states.
 */
import { useEffect } from 'react';
import { statusTone, titleCase } from '../utils/format';

const TONES = {
  green: 'bg-emerald-100 text-emerald-800',
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  purple: 'bg-purple-100 text-purple-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary-container/30 text-primary',
};

export function Icon({ name, className = '', filled = false, size = 20 }) {
  return (
    <span className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`} style={{ fontSize: size }} aria-hidden="true">
      {name}
    </span>
  );
}

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-medium whitespace-nowrap ${TONES[tone] || TONES.slate} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={statusTone(status)}>{titleCase(status)}</Badge>;
}

const BUTTON = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'border border-outline-variant text-on-surface hover:bg-surface-container',
  outline: 'border-2 border-primary text-primary hover:bg-primary-container/10',
  danger: 'bg-error text-on-error hover:opacity-90',
  ghost: 'text-primary hover:bg-primary-container/10',
};

export function Button({ variant = 'primary', icon, children, className = '', size = 'md', ...props }) {
  const sizes = { sm: 'h-8 px-3 text-label-sm', md: 'h-10 px-4 text-label-md', lg: 'h-12 px-5 text-label-md' };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizes[size]} ${BUTTON[variant]} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-headline-md text-on-surface font-semibold">{title}</h1>
        {subtitle && <p className="text-body-md text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-outline-variant mb-4" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-label-md border-b-2 whitespace-nowrap transition-colors ${
            value === t.key ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-label-sm opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { e.stopPropagation(); onClose?.(); }}>
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-surface-container-lowest w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface-container-lowest flex items-center justify-between px-5 py-4 border-b border-outline-variant z-10">
          <h2 className="text-title-lg text-on-surface font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface-container" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="sticky bottom-0 bg-surface-container-lowest px-5 py-4 border-t border-outline-variant flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-label-md text-on-surface font-medium">{label}</span>}
      <div className="mt-1">{children}</div>
      {hint && <span className="text-label-sm text-on-surface-variant mt-1 block">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary focus:outline-none';

export function Input({ className = '', ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ children, className = '', ...props }) {
  return <select className={`${inputClass} ${className}`} {...props}>{children}</select>;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${inputClass} h-auto py-2 resize-none ${className}`} rows={3} {...props} />;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-body-md text-on-surface">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-primary' : 'bg-outline-variant'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Stat({ icon, label, value, note, tone = 'primary', onClick }) {
  return (
    <Card className={`p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${TONES[tone] || TONES.primary}`}>
          <Icon name={icon} />
        </span>
        <div className="min-w-0">
          <p className="text-headline-sm text-on-surface font-bold leading-tight">{value}</p>
          <p className="text-label-sm text-on-surface-variant">{label}</p>
        </div>
      </div>
      {note && <p className="text-label-sm text-on-surface-variant mt-2">{note}</p>}
    </Card>
  );
}

export function Empty({ icon = 'inbox', title, children }) {
  return (
    <div className="text-center py-14 text-on-surface-variant">
      <Icon name={icon} size={48} className="opacity-30" />
      <p className="text-body-md font-medium mt-2">{title}</p>
      {children && <div className="text-label-md mt-1">{children}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant">
      <Icon name="progress_activity" className="animate-spin" />
      <span className="text-body-md">{label}</span>
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-body-sm">{children}</div>;
}

/** Vertical status timeline with timestamps. */
export function Timeline({ steps }) {
  return (
    <ol className="relative ml-3 border-l-2 border-outline-variant space-y-4 py-1">
      {steps.map((s, i) => (
        <li key={`${s.label}-${i}`} className="ml-5 relative">
          <span className={`absolute -left-[29px] top-0.5 w-4 h-4 rounded-full border-2 ${
            s.done ? 'bg-primary border-primary' : s.current ? 'bg-surface border-primary' : 'bg-surface border-outline-variant'
          }`} />
          <p className={`text-label-md ${s.done || s.current ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>{s.label}</p>
          {(s.time || s.note) && (
            <p className="text-label-sm text-on-surface-variant">{[s.time, s.note].filter(Boolean).join(' · ')}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
