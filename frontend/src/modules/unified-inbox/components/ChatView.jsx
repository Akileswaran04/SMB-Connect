
import { useState, useRef, useEffect, useCallback } from 'react';
import { getConversationById, sendMessage, markAsRead, generateDraft, editDraft, sendDraft } from '../../../services/storage';
import AIDraft from '../../ai-communication/components/AIDraft';
import AutoReplyToggle from '../../ai-communication/components/AutoReplyToggle';
import ChatBubble from '../../../components/chat/ChatBubble';
import VoiceInputButton from '../../../components/chat/VoiceInputButton';
import useChatSocket from '../../../hooks/useChatSocket';
import useVoiceAssistant from '../../../hooks/useVoiceAssistant';
import { getSession } from '../../../services/storage';

function formatDateDivider(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shouldShowDateDivider(messages, index) {
  if (index === 0) return true;
  const curr = new Date(messages[index].timestamp).toDateString();
  const prev = new Date(messages[index - 1].timestamp).toDateString();
  return curr !== prev;
}

const emotionMap = { positive: 'Excited', negative: 'Frustrated', neutral: 'Neutral' };
const strategyMap = {
  inform: 'Educational', empathize: 'Reassurance', engage: 'Social Proof',
  acknowledge: 'Social Proof', respond: 'Educational',
};

export default function ChatView({ conversationId, sellerId, onBack, onRefresh, onToast }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [convo, setConvo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const ws = useChatSocket();
  const voice = useVoiceAssistant(getSession()?.language || 'en');

  const reload = useCallback(async () => {
    const data = await getConversationById(conversationId);
    if (data) {
      setConvo(data);
      if (data.unreadCount > 0) await markAsRead(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getConversationById(conversationId);
        if (!cancelled) setConvo(data);
        if (data?.unreadCount > 0) {
          await markAsRead(conversationId);
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convo?.messages?.length]);

  // Live updates: new buyer messages and their translations arrive over the socket.
  useEffect(() => {
    ws.join(conversationId, null);
    const offs = [
      ws.on('message:new', (f) => { if (f.message?.conversation_id === conversationId) { reload(); onRefresh?.(); } }),
      ws.on('message:translation', () => reload()),
    ];
    return () => { offs.forEach((off) => off()); ws.leave(conversationId); };
  }, [ws, conversationId, reload, onRefresh]);

  useEffect(() => {
    if (!aiEnabled || !convo?.messages?.length) return;
    const lastMsg = convo.messages[convo.messages.length - 1];
    if (lastMsg.senderType === 'seller' || lastMsg.isAI) return;

    let cancelled = false;
    setIsAnalyzing(true);
    (async () => {
      try {
        const draft = await generateDraft(conversationId);
        if (!cancelled) {
          setAiDraft({
            id: draft.id,
            response: draft.draft_content,
            emotion: emotionMap[draft.sentiment_label] || 'Neutral',
            strategy: strategyMap[draft.intent] || 'Educational',
            intent: draft.intent,
            leadScore: draft.lead_score ?? null,
          });
        }
      } catch (err) {
        console.error('Failed to generate AI draft:', err);
      } finally {
        if (!cancelled) setIsAnalyzing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [convo?.messages?.length, aiEnabled, conversationId]);

  const handleSendRaw = useCallback(async (text, messageType = 'text') => {
    await sendMessage(conversationId, { text, messageType, clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
    await reload();
  }, [conversationId, reload]);

  const handleVoice = useCallback(async (transcript) => {
    if (!transcript.trim()) return;
    try {
      await handleSendRaw(transcript.trim(), 'voice');
      onRefresh?.();
    } catch (err) {
      onToast?.(err.message || 'Failed to send voice message', 'error');
    }
  }, [handleSendRaw, onRefresh, onToast]);

  const handleAcceptDraft = useCallback(async (text) => {
    if (!aiDraft?.id) {

      await handleSendRaw(text);
      setAiDraft(null);
      onToast?.('AI response sent');
      return;
    }
    try {
      await sendDraft(aiDraft.id);
      onToast?.('AI response approved and sent');
    } catch (err) {
      await handleSendRaw(text);
      onToast?.('Sent (draft approval failed, sent as-is)');
    }
    setAiDraft(null);
    await reload();
    onRefresh?.();
  }, [aiDraft, handleSendRaw, reload, onRefresh, onToast]);

  const handleEditDraft = useCallback(async (editedText) => {
    if (!aiDraft?.id) {
      await handleSendRaw(editedText);
      setAiDraft(null);
      onToast?.('Edited response sent');
      return;
    }
    try {
      await editDraft(aiDraft.id, editedText);
      await sendDraft(aiDraft.id);
      onToast?.('Edited response approved and sent');
    } catch (err) {
      await handleSendRaw(editedText);
      onToast?.('Sent (draft approval failed, sent as-is)');
    }
    setAiDraft(null);
    await reload();
    onRefresh?.();
  }, [aiDraft, handleSendRaw, reload, onRefresh, onToast]);

  const handleRewriteDraft = useCallback(async () => {
    if (!aiDraft?.id) return;
    setIsAnalyzing(true);
    setAiDraft(null);
    try {
      const draft = await generateDraft(conversationId);
      setAiDraft({
        id: draft.id,
        response: draft.draft_content,
        emotion: emotionMap[draft.sentiment_label] || 'Neutral',
        strategy: strategyMap[draft.intent] || 'Educational',
        intent: draft.intent,
        leadScore: draft.lead_score ?? null,
      });
    } catch (err) {
      console.error('Failed to rewrite draft:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [aiDraft, conversationId]);

  const handleDismissDraft = useCallback(() => {
    setAiDraft(null);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    try {
      await handleSendRaw(text);
      setInput('');
      setAiDraft(null);
      onRefresh?.();
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant animate-pulse">sync</span>
      </div>
    );
  }

  if (!convo) return null;

  const messages = convo.messages || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant bg-surface-container-lowest flex-shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-sm font-bold flex-shrink-0">
          {convo.customerName?.charAt(0)?.toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-label-md text-on-surface font-semibold truncate">{convo.customerName}</h3>
          <p className="text-label-sm text-on-surface-variant">Customer</p>
        </div>
      </div>

      <AutoReplyToggle
        enabled={aiEnabled}
        onToggle={setAiEnabled}
        mode="approval"
        onModeChange={() => {}}
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] opacity-30">chat_bubble_outline</span>
            <p className="text-body-md mt-2">Start a conversation</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => (
              <div key={msg.id || i}>
                {shouldShowDateDivider(messages, i) && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-surface-container rounded-full text-label-sm text-on-surface-variant">
                      {formatDateDivider(msg.timestamp)}
                    </span>
                  </div>
                )}
                <ChatBubble message={msg} mine={msg.senderType === 'seller'} onSpeak={voice.speak} />
                {msg.isAI && (
                  <p className="text-right text-label-sm text-primary -mt-1 mb-1 inline-flex items-center gap-0.5 w-full justify-end">
                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span>AI-drafted, approved by you
                  </p>
                )}
              </div>
            ))}

            {isAnalyzing && (
              <div className="flex items-center gap-2 px-4 py-2 text-label-sm text-primary">
                <span className="material-symbols-outlined text-[16px] animate-pulse">auto_awesome</span>
                <span>AI is drafting a reply for your approval...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {aiDraft && (
        <AIDraft
          draft={aiDraft}
          onAccept={handleAcceptDraft}
          onEdit={handleEditDraft}
          onRewrite={handleRewriteDraft}
          onDismiss={handleDismissDraft}
        />
      )}

      <div className="flex items-end gap-2 px-4 py-3 border-t border-outline-variant bg-surface-container-lowest flex-shrink-0">
        <VoiceInputButton voice={voice} onTranscript={handleVoice} />
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiEnabled ? "Type a message (AI will draft a reply for approval)..." : "Type a message..."}
            rows={1}
            className="w-full px-4 py-2.5 rounded-2xl border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors resize-none max-h-32"
            style={{ minHeight: '42px' }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-2.5 rounded-full bg-primary hover:bg-on-primary-fixed-variant disabled:bg-surface-container text-on-primary disabled:text-on-surface-variant transition-colors flex-shrink-0 active:scale-95"
        >
          <span className="material-symbols-outlined text-[22px]">send</span>
        </button>
      </div>
    </div>
  );
}