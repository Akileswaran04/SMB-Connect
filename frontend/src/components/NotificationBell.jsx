/**
 * In-app notifications (PRD §58): unread badge (polled) and a panel listing
 * recent notifications. Clicking one marks it read and hands its data to
 * `onOpen` so the app can jump to the order / shipment it concerns.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { listNotifications, unreadNotifications, markNotificationRead, markAllNotificationsRead } from '../services/smb';
import { Icon } from './ui';
import { timeAgo } from '../utils/format';

const POLL_MS = 20000;

export default function NotificationBell({ onOpen }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const panelRef = useRef(null);

  const refreshCount = useCallback(() => {
    unreadNotifications().then((r) => setCount(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    listNotifications().then(setItems).catch(() => setItems([]));
    const close = (e) => panelRef.current && !panelRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openItem = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
      refreshCount();
    }
    setOpen(false);
    onOpen?.(n);
  };

  const readAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setItems((prev) => (prev || []).map((n) => ({ ...n, is_read: true })));
    setCount(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
        aria-label={`Notifications${count ? ` (${count} unread)` : ''}`}
      >
        <Icon name="notifications" filled={count > 0} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant sticky top-0 bg-surface-container-lowest">
            <p className="text-title-sm font-semibold text-on-surface">Notifications</p>
            {count > 0 && <button onClick={readAll} className="text-label-sm text-primary font-medium">Mark all read</button>}
          </div>
          {items === null ? (
            <p className="p-4 text-label-md text-on-surface-variant">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-label-md text-on-surface-variant">You're all caught up.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 border-b border-outline-variant/60 hover:bg-surface-container-low flex gap-3 ${n.is_read ? '' : 'bg-primary-container/5'}`}
              >
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-primary'}`} />
                <span className="min-w-0">
                  <span className="block text-label-md text-on-surface font-semibold">{n.title}</span>
                  {n.body && <span className="block text-label-sm text-on-surface-variant">{n.body}</span>}
                  <span className="block text-label-sm text-on-surface-variant/70 mt-0.5">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
