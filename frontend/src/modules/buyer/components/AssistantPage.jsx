/**
 * Assistant (PRD §14–15): an action-oriented helper, not a generic chatbot.
 * It searches, filters, compares, checks sizes and delivery, proposes
 * offers, messages sellers, tracks and reorders — by text or voice, in the
 * buyer's language, speaking replies back. Anything that commits the buyer
 * needs their tap.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { assistantChat } from '../../../services/smb';
import useVoiceAssistant from '../../../hooks/useVoiceAssistant';
import RecommendationCard from './RecommendationCard';
import AssistantActions from './AssistantActions';
import VoiceInputButton from '../../../components/chat/VoiceInputButton';
import { Icon } from '../../../components/ui';
import { inr, dayDate, titleCase } from '../../../utils/format';

const SUGGESTIONS = ['Show something cheaper', 'Show something similar', 'Is size 9 available?', 'Can I get this tomorrow?',
  'Which one is better for daily use?', 'Can I bargain?', 'Where is my order?', 'Buy again'];

export default function AssistantPage({ session, prefs, initial, onOpenProduct, onOpenOrder, onOpenCart, onChatOpened, onToast }) {
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(initial?.context || {});
  const endRef = useRef(null);
  const sentInitial = useRef(false);
  const language = session?.language || 'en';
  const voice = useVoiceAssistant(prefs?.voice_settings?.voice_language || language);
  const autoSpeak = prefs?.voice_settings?.auto_speak !== false;

  const send = useCallback(async (message, viaVoice = false) => {
    const text = message.trim();
    if (!text) return;
    setTurns((t) => [...t, { role: 'user', text, voice: viaVoice }]);
    setInput('');
    setBusy(true);
    try {
      const r = await assistantChat(text, context, { voice: viaVoice, language });
      setContext(r.context || {});
      setTurns((t) => [...t, { role: 'assistant', ...r }]);
      if (viaVoice && autoSpeak) voice.speak(r.reply, r.language);
    } catch (err) {
      setTurns((t) => [...t, { role: 'assistant', reply: err.message || 'Sorry, something went wrong.', error: true }]);
    } finally {
      setBusy(false);
    }
  }, [context, language, voice, autoSpeak]);

  useEffect(() => {
    if (initial?.message && !sentInitial.current) {
      sentInitial.current = true;
      send(initial.message);
    }
  }, [initial, send]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns.length, busy]);

  return (
    <div className="flex flex-col max-w-3xl mx-auto" style={{ height: 'calc(100vh - 170px)', minHeight: 480 }}>
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {turns.length === 0 && (
          <div className="text-center pt-8">
            <span className="w-14 h-14 rounded-2xl bg-primary-container/30 text-primary inline-flex items-center justify-center"><Icon name="assistant" size={30} /></span>
            <h1 className="text-headline-sm font-semibold text-on-surface mt-3">How can I help?</h1>
            <p className="text-body-md text-on-surface-variant">Ask me to find, compare, check sizes or delivery, bargain, or track an order — by typing or speaking.</p>
            {context.product_ids?.length > 0 && <p className="text-label-sm text-primary mt-1">I can see the {context.product_ids.length} product(s) you were looking at.</p>}
          </div>
        )}
        {turns.map((t, i) => (t.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <p className="max-w-[80%] bg-primary text-on-primary rounded-2xl rounded-br-md px-4 py-2.5 text-body-md">
              {t.voice && <Icon name="mic" size={14} className="mr-1 align-middle" />}{t.text}
            </p>
          </div>
        ) : (
          <div key={i} className="flex gap-2">
            <span className="w-8 h-8 rounded-full bg-primary-container/30 text-primary flex items-center justify-center flex-shrink-0"><Icon name="assistant" size={18} /></span>
            <div className="flex-1 min-w-0 space-y-2">
              <div className={`rounded-2xl rounded-tl-md px-4 py-2.5 text-body-md ${t.error ? 'bg-error-container text-on-error-container' : 'bg-surface-container-low text-on-surface'}`}>
                {t.reply}
                {!t.error && (
                  <button onClick={() => voice.speak(t.reply, t.language)} className="ml-2 text-primary align-middle" aria-label="Read aloud"><Icon name="volume_up" size={16} /></button>
                )}
              </div>
              {t.recommendations?.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {t.recommendations.map((item) => <RecommendationCard key={item.product_id} item={item} onView={() => onOpenProduct({ id: item.product_id })} />)}
                </div>
              )}
              {t.comparison && (
                <div className="border border-outline-variant rounded-xl p-3 text-label-md space-y-1">
                  {t.comparison.table.map((r) => (
                    <p key={r.product_id}><strong>{r.name}</strong> — {inr(r.price)}, {r.delivery_days <= 1 ? 'tomorrow' : `${r.delivery_days} days`}, {r.rating ? `${r.rating}★` : 'no reviews yet'}</p>
                  ))}
                </div>
              )}
              {t.order && (
                <button onClick={() => onOpenOrder(t.order.order_id)} className="border border-outline-variant rounded-xl p-3 text-label-md text-left w-full hover:border-primary/50">
                  <strong>{t.order.order_number}</strong> · {titleCase(t.order.status)}
                  {t.order.expected_delivery && ` · expected ${dayDate(t.order.expected_delivery)}`}
                </button>
              )}
              <AssistantActions actions={t.actions} onToast={onToast} onOpenOrder={onOpenOrder} onOpenCart={onOpenCart}
                onOpenProduct={(id) => onOpenProduct({ id })} onOpenChat={onChatOpened} />
            </div>
          </div>
        )))}
        {busy && <p className="text-label-md text-on-surface-variant flex items-center gap-2 pl-10"><Icon name="progress_activity" className="animate-spin" size={18} />Working on it…</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy}
            className="h-8 px-3 rounded-full border border-outline-variant text-label-sm text-on-surface-variant whitespace-nowrap hover:border-primary hover:text-primary">{s}</button>
        ))}
      </div>
      <form className="flex gap-2 items-center" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <VoiceInputButton voice={voice} onTranscript={(tx) => send(tx, true)} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={voice.listening ? 'Listening…' : 'Ask anything about shopping…'}
          aria-label="Message the assistant" className="flex-1 h-11 px-4 rounded-full border border-outline-variant bg-surface text-body-md focus:border-primary focus:outline-none" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
          className="w-11 h-11 rounded-full bg-primary text-on-primary disabled:opacity-40 flex items-center justify-center"><Icon name="send" /></button>
      </form>
      {voice.error && <p className="text-label-sm text-error mt-1">{voice.error}</p>}
    </div>
  );
}
