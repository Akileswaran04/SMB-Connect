/**
 * Buyer ↔ seller messages (PRD §16): realtime over the WebSocket, shown in
 * the buyer's language, with spoken messages and read-aloud replies.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getConversations, getConversationById, sendMessage, markAsRead, getSession } from '../../../services/storage';
import useChatSocket from '../../../hooks/useChatSocket';
import useVoiceAssistant from '../../../hooks/useVoiceAssistant';
import ChatBubble from '../../../components/chat/ChatBubble';
import VoiceInputButton from '../../../components/chat/VoiceInputButton';
import { Icon } from '../../../components/ui';
import { timeAgo } from '../../../utils/format';

function mapMsg(m) {
  return {
    id: m.id, senderType: m.sender_type, text: m.content, messageType: m.message_type,
    timestamp: m.created_at, sequenceNumber: m.sequence_number,
    translatedText: m.translated_content, translatedLanguage: m.translated_language,
  };
}

export default function BuyerInbox({ onToast, openConversationId }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(openConversationId || null);
  const [convo, setConvo] = useState(null);
  const [input, setInput] = useState('');
  const [sendingVoice, setSendingVoice] = useState(false);
  const endRef = useRef(null);
  const lastSeqRef = useRef(null);
  const ws = useChatSocket();
  const voice = useVoiceAssistant(getSession()?.language || 'en');

  const loadConversations = useCallback(async () => setConversations(await getConversations()), []);

  const loadThread = useCallback(async (id) => {
    const data = await getConversationById(id);
    if (!data) return;
    setConvo(data);
    const last = data.messages[data.messages.length - 1];
    lastSeqRef.current = last?.sequenceNumber ?? null;
    if (data.unreadCount > 0) await markAsRead(id);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return undefined;
    loadThread(selectedId);
    ws.join(selectedId, lastSeqRef.current);
    return () => ws.leave(selectedId);
  }, [selectedId, ws, loadThread]);

  useEffect(() => {
    const add = (msgs) => setConvo((prev) => {
      if (!prev) return prev;
      const ids = new Set(prev.messages.map((m) => m.id));
      const fresh = msgs.filter((m) => !ids.has(m.id));
      if (!fresh.length) return prev;
      lastSeqRef.current = fresh[fresh.length - 1].sequence_number ?? lastSeqRef.current;
      return { ...prev, messages: [...prev.messages, ...fresh.map(mapMsg)] };
    });
    const offs = [
      ws.on('sync', (f) => f.conversation_id === selectedId && add(f.items || [])),
      ws.on('message:new', (f) => {
        if (f.message?.conversation_id === selectedId) add([f.message]);
        loadConversations();
      }),
      ws.on('message:translation', (f) => setConvo((prev) => prev && ({
        ...prev,
        messages: prev.messages.map((m) => (m.id === f.message_id
          ? { ...m, translatedText: f.translated_content, translatedLanguage: f.translated_language } : m)),
      }))),
    ];
    return () => offs.forEach((off) => off());
  }, [ws, selectedId, loadConversations]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [convo?.messages?.length]);

  const send = async (text, messageType = 'text') => {
    if (!text.trim() || !selectedId) return;
    try {
      await sendMessage(selectedId, { text: text.trim(), messageType, clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      await loadThread(selectedId);
      loadConversations();
    } catch (err) {
      onToast?.(err.message || 'Failed to send', 'error');
    }
  };

  const handleSend = () => {
    const text = input;
    setInput('');
    send(text);
  };

  const handleVoice = async (transcript) => {
    setSendingVoice(true);
    await send(transcript, 'voice');
    setSendingVoice(false);
  };

  const partner = conversations.find((c) => c.id === selectedId)?.customerName || convo?.customerName || 'Seller';

  return (
    <div className="flex flex-col lg:flex-row bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 170px)', minHeight: 480 }}>
      <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 border-r border-outline-variant`}>
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-title-lg text-on-surface font-semibold">Messages</h2>
          <p className="text-label-sm text-on-surface-variant">Chat in your language — sellers read it in theirs.</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-6 text-center text-on-surface-variant text-body-sm">No conversations yet. Open a product and tap “Chat with seller”.</p>
          )}
          {conversations.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40 text-left ${selectedId === c.id ? 'bg-primary-container/10' : 'hover:bg-surface-container-low'}`}>
              <span className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold flex-shrink-0">
                {(c.customerName || 'S').charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-label-md text-on-surface font-semibold truncate">{c.customerName || 'Seller'}</span>
                <span className="block text-label-sm text-on-surface-variant truncate">{c.lastMessage || 'No messages yet'}</span>
              </span>
              <span className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-label-sm text-on-surface-variant">{timeAgo(c.lastMessageTime)}</span>
                {c.unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1 bg-error text-on-error rounded-full text-label-sm font-bold flex items-center justify-center">{c.unreadCount}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-w-0`}>
        {selectedId ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant">
              <button onClick={() => { setSelectedId(null); setConvo(null); }} className="lg:hidden p-2 rounded-full hover:bg-surface-container" aria-label="Back">
                <Icon name="arrow_back" />
              </button>
              <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">{partner.charAt(0).toUpperCase()}</span>
              <p className="text-label-md text-on-surface font-semibold truncate">{partner}</p>
              <span className={`ml-auto text-label-sm ${ws.status === 'open' ? 'text-emerald-600' : 'text-on-surface-variant'}`}>
                {ws.status === 'open' ? '● Live' : '○ Reconnecting'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/50">
              {(convo?.messages || []).map((m, i) => (
                <ChatBubble key={m.id || i} message={m} mine={m.senderType === 'buyer'} onSpeak={voice.speak} />
              ))}
              <div ref={endRef} />
            </div>
            <div className="flex items-center gap-2 px-3 py-3 border-t border-outline-variant">
              <VoiceInputButton voice={voice} onTranscript={handleVoice} />
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={voice.listening ? 'Listening…' : sendingVoice ? 'Sending voice message…' : 'Type a message…'}
                className="flex-1 min-w-0 h-11 px-4 rounded-full border border-outline-variant bg-surface text-body-md focus:border-primary focus:outline-none" />
              <button onClick={handleSend} disabled={!input.trim()} aria-label="Send"
                className="w-11 h-11 rounded-full bg-primary text-on-primary disabled:opacity-40 flex items-center justify-center flex-shrink-0">
                <Icon name="send" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8">
            <Icon name="forum" size={56} className="opacity-30" />
            <p className="text-title-lg font-semibold mt-3">Pick a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
