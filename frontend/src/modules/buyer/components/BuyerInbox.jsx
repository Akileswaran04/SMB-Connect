
import { useState, useEffect, useRef, useCallback } from 'react';
import { getConversations, getConversationById, sendMessage, markAsRead } from '../../../services/storage';
import useChatSocket from '../../../hooks/useChatSocket';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function BuyerInbox({ buyerId, onToast }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [convo, setConvo] = useState(null);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const ws = useChatSocket();
  const lastSeqRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const list = await getConversations();
    setConversations(list);
  }, []);

  const loadThread = useCallback(async (id) => {
    const data = await getConversationById(id);
    if (!data) return;
    setConvo(data);
    const last = data.messages[data.messages.length - 1];
    lastSeqRef.current = last ? last.sequenceNumber ?? null : null;
    if (data.unreadCount > 0) await markAsRead(id);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    loadThread(selectedId);
    ws.join(selectedId, lastSeqRef.current);
    return () => ws.leave(selectedId);
  }, [selectedId, ws]);

  useEffect(() => {
    const offSync = ws.on('sync', (frame) => {
      if (frame.conversation_id !== selectedId) return;
      setConvo((prev) => {
        if (!prev) return prev;
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const fresh = (frame.items || []).filter((m) => !existingIds.has(m.id));
        const last = fresh[fresh.length - 1];
        if (last?.sequence_number != null) lastSeqRef.current = last.sequence_number;
        return { ...prev, messages: [...prev.messages, ...fresh.map(mapMsg)] };
      });
    });
    const offNew = ws.on('message:new', (frame) => {
      const msg = frame.message;
      if (msg?.conversation_id !== selectedId) return;
      setConvo((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        if (msg.sequence_number != null) lastSeqRef.current = msg.sequence_number;
        return { ...prev, messages: [...prev.messages, mapMsg(msg)] };
      });
      loadConversations();
    });
    return () => { offSync(); offNew(); };
  }, [ws, selectedId, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convo?.messages?.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedId) return;
    setInput('');
    try {
      const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await sendMessage(selectedId, { text, clientMessageId });
      await loadThread(selectedId);
      loadConversations();
    } catch (err) {
      onToast?.(err.message || 'Failed to send', 'error');
    }
  };

  const handleSelect = async (id) => {
    setSelectedId(id);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-0 bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 160px)', minHeight: '500px' }}>
      <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-96 border-r border-outline-variant`}>
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-headline-md text-on-surface font-semibold">My Inbox</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-on-surface-variant text-body-sm">
              No conversations yet. Open a product and tap Chat to start one.
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40 text-left transition-colors ${
                selectedId === c.id ? 'bg-primary-container/10' : 'hover:bg-surface-container-low'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold flex-shrink-0">
                {c.customerName?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-label-md text-on-surface font-semibold truncate">{c.customerName || 'Seller'}</p>
                <p className="text-label-sm text-on-surface-variant truncate">{c.lastMessage || 'No messages yet'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-label-sm text-on-surface-variant">{timeAgo(c.lastMessageTime)}</span>
                {c.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-error text-on-error rounded-full text-label-sm font-bold flex items-center justify-center">
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-w-0`}>
        {selectedId ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant">
              <button onClick={() => { setSelectedId(null); setConvo(null); }} className="lg:hidden p-2 rounded-full hover:bg-surface-container">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                {convo?.customerName?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <p className="text-label-md text-on-surface font-semibold">{convo?.customerName || 'Seller'}</p>
              <span className={`ml-auto text-label-sm ${ws.status === 'open' ? 'text-emerald-600' : 'text-on-surface-variant'}`}>
                {ws.status === 'open' ? '● Online' : '○ Offline'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/50 space-y-1">
              {(convo?.messages || []).map((m, i) => (
                <BuyerMessageBubble key={m.id || i} message={m} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-end gap-2 px-4 py-3 border-t border-outline-variant">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                className="flex-1 h-11 px-4 rounded-2xl border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-11 h-11 rounded-full bg-primary text-on-primary disabled:bg-surface-container disabled:text-on-surface-variant flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8">
            <span className="material-symbols-outlined text-[64px] opacity-30">chat</span>
            <p className="text-headline-md mt-4" style={{ fontWeight: 600 }}>Your Inbox</p>
            <p className="text-body-md text-center mt-2 max-w-sm">Select a conversation to view messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BuyerMessageBubble({ message: m }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const hasTranslation = !!m.translatedText;
  const isBuyer = m.senderType === 'buyer';

  return (
    <div className={`flex ${isBuyer ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className="max-w-[75%]">
        <div className={`px-3.5 py-2.5 text-body-md leading-relaxed rounded-2xl ${
          isBuyer
            ? 'bg-primary text-on-primary rounded-br-md'
            : 'bg-surface-container-low text-on-surface border border-outline-variant/50 rounded-bl-md'
        }`}>
          {showTranslation && hasTranslation ? m.translatedText : m.text}
        </div>
        {hasTranslation && (
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`inline-flex items-center gap-0.5 text-label-sm text-primary mt-0.5 ${isBuyer ? 'float-right' : ''}`}
          >
            <span className="material-symbols-outlined text-[12px]">translate</span>
            {showTranslation ? 'Show original' : `See translation (${m.translatedLanguage})`}
          </button>
        )}
        <p className={`text-label-sm text-on-surface-variant mt-0.5 ${isBuyer ? 'text-right' : 'text-left'}`}>
          {new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function mapMsg(m) {
  return {
    id: m.id,
    senderType: m.sender_type,
    text: m.content,
    timestamp: m.created_at,
    sequenceNumber: m.sequence_number,
    sentiment: m.sentiment,
    translatedText: m.translated_content,
    translatedLanguage: m.translated_language,
  };
}