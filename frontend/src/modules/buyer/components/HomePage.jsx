/**
 * HomePage — guided buying, the buyer's default landing tab (PRD §7-10).
 * "What are you looking for today?" -> AI extracts the requirement -> 2-3
 * reasoned recommendations, or one short clarifying question. Catalogue
 * search stays one tab away for buyers who already know what they want.
 */
import { useState, useCallback, useEffect } from 'react';
import { understandRequirement, understandVoice, getMyLanguage } from '../../../services/storage';
import WhyThis from '../../../components/shared/WhyThis';
import useVoiceAssistant from '../../../hooks/useVoiceAssistant';

const QUICK_CATEGORIES = ['Footwear', 'Clothing', 'Electronics', 'Home Decor', 'Groceries', 'Accessories'];

const TAG_STYLES = {
  'Best Fit': { bg: 'bg-primary-container/40', text: 'text-primary', label: 'Best Fit' },
  'Better Value': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Better Value' },
  'Faster Delivery': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Faster Delivery' },
};

export default function HomePage({ onOpenProduct, onGoToCatalogue }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { understood, question, recommendations, extraction }
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    getMyLanguage().then(setLanguage);
  }, []);

  const voice = useVoiceAssistant(language);

  const ask = useCallback(async (query) => {
    const trimmed = (query ?? text).trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const data = await understandRequirement(trimmed);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Could not process that — try again');
    } finally {
      setLoading(false);
    }
  }, [text]);

  const askByVoice = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setText(trimmed);
    setLoading(true);
    setError('');
    understandVoice(trimmed, language)
      .then((data) => {
        setResult(data);
        voice.speak(data.spoken_reply, data.spoken_reply_language);
      })
      .catch((err) => setError(err.message || 'Could not process that — try again'))
      .finally(() => setLoading(false));
  }, [language, voice]);

  const handleMic = () => {
    if (voice.listening) {
      voice.stopListening();
      return;
    }
    voice.startListening(askByVoice);
  };

  const handleQuickCategory = (category) => {
    const query = `Show me ${category.toLowerCase()}`;
    setText(query);
    ask(query);
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <h1 className="text-headline-lg text-on-surface font-bold">What are you looking for today?</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Tell us what you need — we'll find the right options.</p>
      </div>

      <div className="max-w-xl mx-auto">
        <div className="relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder={voice.listening ? 'Listening...' : 'e.g. black formal shoes under $30'}
            className="w-full h-14 pl-5 pr-24 rounded-2xl border border-outline-variant bg-surface text-body-md text-on-surface focus:border-primary focus:outline-none shadow-sm"
          />
          {voice.supported && (
            <button
              onClick={handleMic}
              title={voice.listening ? 'Stop listening' : 'Speak your request'}
              className={`absolute right-14 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${voice.listening ? 'bg-error text-on-error animate-pulse' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <span className="material-symbols-outlined text-[20px]">{voice.listening ? 'mic' : 'mic_none'}</span>
            </button>
          )}
          <button
            onClick={() => ask()}
            disabled={loading || !text.trim()}
            className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">{loading ? 'sync' : 'arrow_forward'}</span>
          </button>
        </div>

        {voice.error && <p className="text-label-sm text-error text-center mt-2">{voice.error}</p>}

        {!result && (
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {QUICK_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => handleQuickCategory(c)}
                className="h-9 px-4 rounded-full border border-outline-variant text-label-md text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="max-w-xl mx-auto bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant animate-pulse">sync</span>
        </div>
      )}

      {result && !loading && !result.understood && (
        <div className="max-w-xl mx-auto text-center bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
          <span className="material-symbols-outlined text-[32px] text-primary">help</span>
          <p className="text-title-sm text-on-surface font-semibold mt-2">{result.question}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Try again above, or browse the catalogue.</p>
        </div>
      )}

      {result && !loading && result.understood && (
        <div className="space-y-4">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-label-md text-on-surface-variant">
              Got it{result.extraction?.category ? ` — looking for ${result.extraction.category}` : ''}
              {result.extraction?.budget ? ` under $${result.extraction.budget.toLocaleString()}` : ''}.
            </p>
          </div>

          {result.recommendations.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] opacity-30">search_off</span>
              <p className="text-body-md mt-2">Nothing matched exactly — try the catalogue for more options.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {result.recommendations.map((item) => {
                const tagStyle = TAG_STYLES[item.tag] || TAG_STYLES['Best Fit'];
                return (
                  <div key={item.product_id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden flex flex-col">
                    <div className="h-32 bg-surface-container flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">inventory_2</span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-1.5 flex-1">
                      <span className={`self-start px-2 py-0.5 rounded-full text-label-sm font-semibold ${tagStyle.bg} ${tagStyle.text}`}>
                        {tagStyle.label}
                      </span>
                      <p className="text-title-lg text-primary font-bold">${item.price.toLocaleString()}</p>
                      <p className="text-label-md text-on-surface font-semibold">{item.name}</p>
                      <p className="text-label-sm text-on-surface-variant">{item.seller_name}</p>
                      <WhyThis reasons={item.reasons} />
                      <button
                        onClick={() => onOpenProduct({ id: item.product_id, seller_id: item.seller_id })}
                        className="mt-2 h-10 rounded-lg bg-primary text-on-primary text-label-md font-medium"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="text-center pt-2">
        <button onClick={onGoToCatalogue} className="text-label-md text-primary font-medium inline-flex items-center gap-1">
          Browse the full catalogue instead
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
