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
import { inr, dayDate, statusText } from '../../../utils/format';
import { getLang, t } from '../../../i18n';

const SUGGESTIONS = ['Show something cheaper', 'Show something similar', 'Is size 9 available?', 'Can I get this tomorrow?',
  'Which one is better for daily use?', 'Can I bargain?', 'Where is my order?', 'Buy again'];

export default function AssistantPage({ session, prefs, initial, onOpenProduct, onOpenOrder, onOpenCart, onChatOpened, onToast }) {
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(initial?.context || {});
  const endRef = useRef(null);
  const sentInitial = useRef(false);
  const language = getLang() || session?.language || 'en';
  const voice = useVoiceAssistant(prefs?.voice_settings?.voice_language || language);
  const autoSpeak = prefs?.voice_settings?.auto_speak !== false;

  const send = useCallback(async (message, viaVoice = false) => {
    const text = message.trim();
    if (!text) return;
    setTurns((prev) => [...prev, { role: 'user', text, voice: viaVoice }]);
    setInput('');
    setBusy(true);
    try {
      const r = await assistantChat(text, context, { voice: viaVoice, language });
      setContext(r.context || {});
      setTurns((prev) => [...prev, { role: 'assistant', ...r }]);
      if (viaVoice && autoSpeak) voice.speak(r.reply, r.language);
    } catch (err) {
      setTurns((prev) => [...prev, { role: 'assistant', reply: err.message, error: true }]);
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
    <div className="flex flex-col max-w-3xl mx-auto" style={{ height: 'calc(100dvh - 180px)', minHeight: 420 }}>
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {turns.length === 0 && (
          <div className="text-center pt-8">
            <span className="w-14 h-14 rounded-2xl bg-primary-container/30 text-primary inline-flex items-center justify-center"><Icon name="assistant" size={30} /></span>
            <h1 className="text-headline-sm font-semibold text-on-surface mt-3">{t('How can I help?')}</h1>
            <p className="text-body-md text-on-surface-variant">{t('Ask me to find something, compare, check size or delivery, bargain, or find your order. Tap the mic and speak.')}</p>
            {context.product_ids?.length > 0 && <p className="text-label-md text-primary mt-1">{t('I can see the products you were looking at.')}</p>}
          </div>
        )}
        {turns.map((turn, i) => (turn.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <p className="max-w-[80%] bg-primary text-on-primary rounded-2xl rounded-br-md px-4 py-2.5 text-body-md">
              {turn.voice && <Icon name="mic" size={14} className="mr-1 align-middle" />}{turn.text}
            </p>
          </div>
        ) : (
          <div key={i} className="flex gap-2">
            <span className="w-8 h-8 rounded-full bg-primary-container/30 text-primary flex items-center justify-center flex-shrink-0"><Icon name="assistant" size={18} /></span>
            <div className="flex-1 min-w-0 space-y-2">
              <div className={`rounded-2xl rounded-tl-md px-4 py-2.5 text-body-md ${turn.error ? 'bg-error-container text-on-error-container' : 'bg-surface-container-low text-on-surface'}`}>
                {turn.reply}
                {!turn.error && (
                  <button onClick={() => voice.speak(turn.reply, turn.language)} className="ml-2 text-primary align-middle w-8 h-8 inline-flex items-center justify-center" aria-label={t('Play aloud')}><Icon name="volume_up" size={20} /></button>
                )}
              </div>
              {turn.recommendations?.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {turn.recommendations.map((item) => <RecommendationCard key={item.product_id} item={item} onView={() => onOpenProduct({ id: item.product_id })} />)}
                </div>
              )}
              {turn.comparison && (
                <div className="border border-outline-variant rounded-xl p-3 text-label-md space-y-1">
                  {turn.comparison.table.map((r) => (
                    <p key={r.product_id}><strong>{r.name}</strong> — {inr(r.price)}, {r.delivery_days <= 1 ? t('tomorrow') : t('{n} days', { n: r.delivery_days })}, {r.rating ? `${r.rating}★` : t('no reviews yet')}</p>
                  ))}
                </div>
              )}
              {turn.order && (
                <button onClick={() => onOpenOrder(turn.order.order_id)} className="border border-outline-variant rounded-xl p-3 text-label-md text-left w-full hover:border-primary/50">
                  <strong>{turn.order.order_number}</strong> · {statusText(turn.order.status)}
                  {turn.order.expected_delivery && ` · ${dayDate(turn.order.expected_delivery)}`}
                </button>
              )}
              <AssistantActions actions={turn.actions} onToast={onToast} onOpenOrder={onOpenOrder} onOpenCart={onOpenCart}
                onOpenProduct={(id) => onOpenProduct({ id })} onOpenChat={onChatOpened} />
            </div>
          </div>
        )))}
        {busy && <p className="text-label-md text-on-surface-variant flex items-center gap-2 pl-10"><Icon name="progress_activity" className="animate-spin" size={18} />{t('Please wait…')}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(t(s))} disabled={busy}
            className="h-10 px-3 rounded-full border border-outline-variant text-label-md text-on-surface-variant whitespace-nowrap hover:border-primary hover:text-primary">{t(s)}</button>
        ))}
      </div>
      <form className="flex gap-2 items-center" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <VoiceInputButton voice={voice} onTranscript={(tx) => send(tx, true)} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={voice.listening ? t('Listening…') : t('Type, or tap the mic and speak')}
          aria-label={t('Ask')} className="flex-1 h-11 px-4 rounded-full border border-outline-variant bg-surface text-body-md focus:border-primary focus:outline-none" />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t('Send')}
          className="w-11 h-11 rounded-full bg-primary text-on-primary disabled:opacity-40 flex items-center justify-center"><Icon name="send" /></button>
      </form>
      {voice.error && <p className="text-label-sm text-error mt-1">{voice.error}</p>}
    </div>
  );
}
