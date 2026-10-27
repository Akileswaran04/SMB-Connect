/** Seller's chats with buyers, newest first, with search. */
import { useState, useEffect } from 'react';
import { getConversations } from '../../../services/storage';
import { LoadError } from '../../../components/ui';
import { t } from '../../../i18n';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) return t('Yesterday');
  if (diffDays < 7) {
    return date.toLocaleDateString('en-IN', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ConversationList({ sellerId, selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getConversations();
        if (!cancelled) setConversations(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sellerId, attempt]);

  const sorted = [...conversations].sort((a, b) => {
    const ta = new Date(a.lastMessageTime || 0);
    const tb = new Date(b.lastMessageTime || 0);
    return tb - ta;
  });

  const filtered = sorted.filter((c) => {
    const q = search.toLowerCase().trim();
    return !q || c.customerName.toLowerCase().includes(q) || (c.lastMessage || '').toLowerCase().includes(q);
  });

  if (error) return <LoadError message={error} onRetry={() => { setError(''); setLoading(true); setAttempt((n) => n + 1); }} />;

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-lowest">
          <h2 className="text-headline-md text-on-surface" style={{ fontWeight: 600 }}>{t('Messages')}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant animate-pulse">sync</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-lowest">
        <h2 className="text-headline-md text-on-surface" style={{ fontWeight: 600 }}>{t('Messages')}</h2>
        <div className="relative mt-2">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search by name or message')}
            className="w-full h-11 pl-10 pr-4 rounded-full border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] opacity-30">forum</span>
            <p className="text-body-md mt-2">{conversations.length === 0 ? t('No messages yet. Buyers who ask about your products will show up here.') : t('No matches')}</p>
          </div>
        )}

        {filtered.map((convo) => {
          const isSelected = selectedId === convo.id;
          const hasUnread = convo.unreadCount > 0;

          return (
            <button
              key={convo.id}
              onClick={() => onSelect(convo.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-outline-variant/50 ${
                isSelected
                  ? 'bg-primary-container/10'
                  : 'hover:bg-surface-container-low'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold flex-shrink-0">
                {convo.customerName?.charAt(0)?.toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-label-md truncate ${hasUnread ? 'text-on-surface font-bold' : 'text-on-surface'}`}>
                    {convo.customerName}
                  </span>
                  <span className={`text-label-sm flex-shrink-0 ${hasUnread ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                    {formatTime(convo.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-label-sm truncate ${hasUnread ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>
                    {convo.lastMessage || t('No messages yet')}
                  </p>
                  {hasUnread && (
                    <span className="w-5 h-5 bg-primary text-on-primary rounded-full text-label-sm font-bold flex items-center justify-center flex-shrink-0">
                      {convo.unreadCount}
                    </span>
                  )}
                </div>
                {convo.orderTag && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-surface-container rounded-full text-label-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                    {convo.orderTag}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
