/**
 * Home — "Help me buy" (PRD §7–10, §64). The buyer says what they need
 * (text or voice, any supported language); we show what we understood, ask
 * at most one question, and offer 2–3 reasoned picks. Returning buyers also
 * see Buy Again, recent purchases and picks based on their preferences.
 */
import { useState, useCallback, useEffect } from 'react';
import { assistantUnderstand, assistantVoice, getCategories, getHome, reorder } from '../../../services/smb';
import useVoiceAssistant from '../../../hooks/useVoiceAssistant';
import RecommendationCard from './RecommendationCard';
import CompareModal from './CompareModal';
import AssistantActions from './AssistantActions';
import { Icon, Badge, Button, ErrorNote, Loading } from '../../../components/ui';
import { inr, titleCase, dateShort, statusText } from '../../../utils/format';
import { getLang, t } from '../../../i18n';

// Examples in the way people actually type in each language.
const PROMPTS = {
  en: ['Black formal shoes under ₹1500', 'Filter coffee powder', 'Silk saree for a wedding'],
  hi: ['500 rupaye ke andar cotton kurta', 'शादी के लिए सिल्क साड़ी', 'Filter coffee powder'],
  ta: ['1500 kulla black formal shoe venum', 'கல்யாணத்துக்கு பட்டுப் புடவை', 'Filter coffee powder'],
  tanglish: ['1500 kulla black formal shoe venum', 'Kalyanathukku silk saree', 'Filter coffee powder'],
};

export default function HomePage({ session, prefs, onOpenProduct, onGoToCatalogue, onOpenOrder, onOpenCart, onOpenChat, onAskAssistant, onToast }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [home, setHome] = useState(null);
  const [compare, setCompare] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const language = getLang() || session?.language || 'en';
  const prompts = PROMPTS[language] || PROMPTS.en;
  const voice = useVoiceAssistant(prefs?.voice_settings?.voice_language || language);
  const autoSpeak = prefs?.voice_settings?.auto_speak !== false;

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    getHome().then(setHome).catch(() => {});
  }, []);

  const ask = useCallback(async (query, priority) => {
    const q = (query ?? text).trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setCompare([]);
    try {
      const data = await assistantUnderstand(q, priority);
      setResult({ ...data, query: q, kind: 'understand' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [text]);

  const askByVoice = useCallback(async (transcript) => {
    const q = transcript.trim();
    if (!q) return;
    setText(q);
    setLoading(true);
    setError('');
    try {
      const data = await assistantVoice(q, language);
      setResult({ ...data, query: q, kind: 'voice' });
      if (autoSpeak) voice.speak(data.spoken_reply, data.spoken_reply_language);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [language, voice, autoSpeak]);

  const toggleCompare = (item) => setCompare((prev) => (
    prev.includes(item.product_id) ? prev.filter((id) => id !== item.product_id) : [...prev, item.product_id].slice(-3)
  ));

  const buyAgain = async (entry) => {
    try {
      const r = await reorder(entry.order_id);
      onToast?.(r.added_to_cart ? t('Added to your cart') : t('Not available right now'), r.added_to_cart ? 'success' : 'error');
      if (r.added_to_cart) onOpenCart({ addressId: r.address_id, deliveryOption: r.delivery_option, paymentMethod: r.payment_method });
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  const ex = result?.extraction;
  const understoodChips = ex ? [
    ex.matched_category || ex.category, ex.keywords, ex.color && titleCase(ex.color),
    (ex.size || ex.applied_size) && `${t('Size')} ${ex.size || ex.applied_size}`, ex.budget && t('Under {amount}', { amount: inr(ex.budget) }),
    ex.use_case && `For ${ex.use_case}`, ex.priority && `${titleCase(ex.priority)} first`,
  ].filter(Boolean) : [];
  const recs = result?.recommendations || [];

  return (
    <div className="space-y-8">
      <section className="text-center pt-4">
        {home?.is_returning && <p className="text-label-md text-primary font-semibold">{t('Welcome back, {name}', { name: home.first_name })}</p>}
        <h1 className="text-headline-lg text-on-surface font-bold mt-1">{t('What do you want to buy today?')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">{t('Speak or type in your own language. We will show you the best few choices.')}</p>

        {voice.supported && (
          <button type="button" onClick={() => (voice.listening ? voice.stopListening() : voice.startListening(askByVoice))}
            className={`mt-5 mx-auto flex items-center justify-center gap-3 h-16 px-8 rounded-full text-title-md font-semibold shadow-md ${voice.listening ? 'bg-error text-on-error animate-pulse' : 'bg-primary text-on-primary'}`}>
            <Icon name={voice.listening ? 'graphic_eq' : 'mic'} size={30} />
            {voice.listening ? t('Listening… tap to stop') : t('Tap and speak')}
          </button>
        )}

        <form className="max-w-xl mx-auto mt-5 relative" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={voice.listening ? t('Listening…') : t('Or type here, e.g. {example}', { example: prompts[0] })}
            aria-label={t('What do you want to buy today?')}
            className="w-full h-14 pl-5 pr-28 rounded-2xl border border-outline-variant bg-surface text-body-lg text-on-surface focus:border-primary focus:outline-none shadow-sm"
          />
          {voice.supported && (
            <button type="button" onClick={() => (voice.listening ? voice.stopListening() : voice.startListening(askByVoice))}
              aria-label={voice.listening ? t('Stop listening') : t('Speak')}
              className={`absolute right-14 top-2 w-10 h-10 rounded-xl flex items-center justify-center ${voice.listening ? 'bg-error text-on-error animate-pulse' : 'text-on-surface-variant hover:bg-surface-container'}`}>
              <Icon name={voice.listening ? 'graphic_eq' : 'mic'} />
            </button>
          )}
          <button type="submit" disabled={loading || !text.trim()} aria-label={t('Search')}
            className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40">
            <Icon name={loading ? 'progress_activity' : 'arrow_forward'} className={loading ? 'animate-spin' : ''} />
          </button>
        </form>
        {voice.error && <p className="text-label-md text-error mt-2">{voice.error}</p>}
        {!voice.supported && <p className="text-label-md text-on-surface-variant mt-2">{t('To search by voice, open this site in Chrome.')}</p>}

        {!result && (
          <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-2xl mx-auto">
            {categories.slice(0, 8).map((c) => (
              <button key={c.name} onClick={() => { setText(`Show me ${c.name.toLowerCase()}`); ask(`Show me ${c.name}`); }}
                className="h-11 px-4 rounded-full border border-outline-variant text-label-md text-on-surface-variant hover:border-primary hover:text-primary inline-flex items-center gap-1.5">
                {c.icon && <Icon name={c.icon} size={16} />}{c.name}
              </button>
            ))}
          </div>
        )}
        {!result && !home?.is_returning && (
          <div className="mt-4 flex flex-wrap justify-center items-center gap-2 text-label-md text-on-surface-variant">{t('Try:')} {prompts.map((p) => (
            <button key={p} onClick={() => { setText(p); ask(p); }} className="min-h-10 px-3 rounded-full bg-surface-container text-primary">{p}</button>
          ))}</div>
        )}
      </section>

      <div className="max-w-xl mx-auto"><ErrorNote>{error}</ErrorNote></div>
      {loading && <Loading label={t('Finding the best options…')} />}

      {result && !loading && (
        <section className="space-y-4">
          {result.kind === 'voice' && result.spoken_reply && (
            <div className="max-w-2xl mx-auto bg-surface-container-low rounded-2xl p-4 flex gap-3">
              <Icon name="assistant" className="text-primary" />
              <div className="flex-1">
                <p className="text-body-md text-on-surface">{result.spoken_reply}</p>
                <div className="flex gap-3 mt-1">
                  <button onClick={() => voice.speak(result.spoken_reply, result.spoken_reply_language)} className="text-label-sm text-primary inline-flex items-center gap-1">
                    <Icon name="volume_up" size={18} /> {t('Play again')}
                  </button>
                </div>
                <AssistantActions actions={result.actions} onToast={onToast} onOpenOrder={onOpenOrder} onOpenCart={onOpenCart}
                  onOpenProduct={(id) => onOpenProduct({ id })} onOpenChat={onOpenChat} />
              </div>
            </div>
          )}

          {result.kind === 'understand' && !result.understood && (
            <div className="max-w-xl mx-auto text-center bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
              <Icon name="help" size={32} className="text-primary" />
              <p className="text-title-md text-on-surface font-semibold mt-2">{result.question}</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {(result.options || []).map((o) => <Button key={o} size="sm" variant="secondary" onClick={() => ask(`${result.query} ${o}`)}>{o}</Button>)}
              </div>
            </div>
          )}

          {understoodChips.length > 0 && (
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-label-md text-on-surface-variant">{t('I understood')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1.5">{understoodChips.map((c) => <Badge key={c} tone="primary">{c}</Badge>)}</div>
              {result.personal_note && (
                <p className="text-label-sm text-on-surface-variant mt-2">
                  {result.personal_note} {t('Say a different size to change it.')}
                </p>
              )}
            </div>
          )}

          {result.follow_up && (
            <div className="max-w-xl mx-auto text-center">
              <p className="text-label-md text-on-surface font-semibold">{result.follow_up.text}</p>
              <div className="flex gap-2 justify-center mt-2">
                {result.follow_up.options.map((o) => (
                  <Button key={o.priority} size="sm" variant="outline" onClick={() => ask(result.query, o.priority)}>{o.label}</Button>
                ))}
              </div>
            </div>
          )}

          {recs.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {recs.map((item) => (
                  <RecommendationCard key={item.product_id} item={item} onView={() => onOpenProduct({ id: item.product_id })}
                    onCompareToggle={toggleCompare} compared={compare.includes(item.product_id)} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {compare.length >= 2 && <Button icon="compare_arrows" onClick={() => setShowCompare(true)}>{t('Compare {n}', { n: compare.length })}</Button>}
                <Button variant="secondary" icon="assistant"
                  onClick={() => onAskAssistant({ product_ids: recs.map((r) => r.product_id), last_extraction: result.extraction })}>
                  {t('Ask about these')}
                </Button>
              </div>
            </>
          ) : result.understood && result.kind === 'understand' && (
            <div className="text-center py-8 text-on-surface-variant">
              <Icon name="search_off" size={44} className="opacity-30" />
              <p className="text-body-md mt-2">{t('Nothing matched exactly. Try other words, or look in the shop.')}</p>
            </div>
          )}
          <div className="text-center">
            <button onClick={() => { setResult(null); setText(''); }} className="h-11 px-4 text-label-md text-primary font-medium">{t('Start again')}</button>
          </div>
        </section>
      )}

      {!result && home?.is_returning && (
        <div className="space-y-8 max-w-5xl mx-auto">
          {home.hints?.length > 0 && (
            <div className="bg-primary-container/10 border border-primary/15 rounded-xl px-4 py-3 text-label-md text-on-surface flex gap-2">
              <Icon name="lightbulb" className="text-primary" size={18} />
              <span>{home.hints.join(' ')}</span>
            </div>
          )}
          {home.buy_again?.length > 0 && (
            <section>
              <h2 className="text-title-lg font-semibold text-on-surface mb-3">{t('Buy again')}</h2>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                {home.buy_again.map((b) => (
                  <div key={`${b.product_id}-${b.variant_id}`} className="w-52 flex-shrink-0 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                    <button onClick={() => onOpenProduct({ id: b.product_id })} className="block w-full h-24 bg-surface-container">
                      {b.image_url ? <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" /> : <Icon name="inventory_2" size={32} className="text-on-surface-variant/40" />}
                    </button>
                    <div className="p-3">
                      <p className="text-label-md font-semibold text-on-surface truncate">{b.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{b.variant_label || b.seller_name}</p>
                      <p className="text-label-md font-bold text-on-surface mt-1">{inr(b.current_price)}</p>
                      <Button size="sm" className="w-full mt-2" icon="replay" disabled={!b.available} onClick={() => buyAgain(b)}>
                        {b.available ? t('Buy again') : t('Out of stock')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {home.based_on_preferences?.length > 0 && (
            <section>
              <h2 className="text-title-lg font-semibold text-on-surface mb-3">{t('Picked for you')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {home.based_on_preferences.map((item) => (
                  <RecommendationCard key={item.product_id} item={item} onView={() => onOpenProduct({ id: item.product_id })} />
                ))}
              </div>
            </section>
          )}
          {home.recent_purchases?.length > 0 && (
            <section>
              <h2 className="text-title-lg font-semibold text-on-surface mb-3">{t('Your recent orders')}</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {home.recent_purchases.map((o) => (
                  <button key={o.order_id} onClick={() => onOpenOrder(o.order_id)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-left hover:border-primary/50">
                    <span className="w-12 h-12 rounded-lg bg-surface-container overflow-hidden flex items-center justify-center flex-shrink-0">
                      {o.image_url ? <img src={o.image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="receipt_long" className="text-on-surface-variant/50" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-label-md font-semibold text-on-surface truncate">{o.title}</span>
                      <span className="block text-label-sm text-on-surface-variant">{dateShort(o.created_at)} · {inr(o.total_amount)}</span>
                    </span>
                    <Badge tone="slate">{statusText(o.status)}</Badge>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="text-center">
        <button onClick={onGoToCatalogue} className="h-11 px-4 text-label-md text-primary font-medium inline-flex items-center gap-1">
          {t('See all products in the shop')} <Icon name="arrow_forward" size={18} />
        </button>
      </div>

      {showCompare && <CompareModal productIds={compare} onClose={() => setShowCompare(false)} onOpenProduct={(id) => { setShowCompare(false); onOpenProduct({ id }); }} />}
    </div>
  );
}
