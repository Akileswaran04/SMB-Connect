/**
 * Seller bargaining (PRD §19, §35). Offers waiting for an answer come first.
 * Rules are one question — "How much discount can you give?" — which fills
 * in the lowest price and the auto-accept price; the exact numbers, counter
 * range, number of tries and bulk discounts stay under "Advanced".
 */
import { useState, useEffect, useCallback } from 'react';
import { listMyProducts, getRule, saveRule, listOffers, respondOffer } from '../../services/smb';
import { PageHeader, Tabs, Card, Button, Loading, LoadError, Empty, Field, Input, Select, Toggle, Badge, Icon, inputClass } from '../../components/ui';
import { inr, timeAgo, statusText } from '../../utils/format';
import { t } from '../../i18n';

const EMPTY_RULE = { enabled: true, min_price: '', auto_accept_threshold: '', counter_offer_range_pct: 10, max_rounds: 2, quantity_discount_rules: [] };
const PRESETS = [0, 5, 10, 15, 20];

/** "Up to 10% off" on ₹1000 → lowest ₹900, offers of ₹950 or more accepted automatically. */
const fromPreset = (price, pct) => ({
  enabled: pct > 0,
  min_price: Math.round(price * (1 - pct / 100)),
  auto_accept_threshold: pct > 0 ? Math.round(price * (1 - pct / 200)) : '',
});

export default function NegotiationTab({ onToast, focus }) {
  const [tab, setTab] = useState(focus?.productId ? 'rules' : 'offers');
  const [offers, setOffers] = useState(null);
  const [offersError, setOffersError] = useState('');
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(focus?.productId || '');
  const [rule, setRule] = useState(EMPTY_RULE);
  const [counters, setCounters] = useState({});
  const [busy, setBusy] = useState(null);

  const loadOffers = useCallback(async () => {
    setOffersError('');
    try { setOffers(await listOffers()); } catch (err) { setOffersError(err.message); }
  }, []);
  useEffect(() => {
    loadOffers();
    listMyProducts().then((r) => setProducts(r.items.filter((p) => p.status === 'published'))).catch(() => {});
  }, [loadOffers]);

  useEffect(() => {
    if (!productId) return;
    const price = products.find((p) => p.id === Number(productId))?.price || 0;
    getRule(productId).then((r) => setRule(r ? { ...EMPTY_RULE, ...r, auto_accept_threshold: r.auto_accept_threshold ?? '' } : {
      ...EMPTY_RULE, ...fromPreset(price, 10),
    })).catch(() => setRule(EMPTY_RULE));
  }, [productId, products]);

  const product = products.find((p) => p.id === Number(productId));
  const pct = product && rule.enabled && rule.min_price ? Math.round((1 - Number(rule.min_price) / product.price) * 100) : 0;

  const save = async () => {
    try {
      await saveRule(productId, {
        enabled: rule.enabled, min_price: Number(rule.min_price || product.price),
        auto_accept_threshold: rule.auto_accept_threshold === '' ? null : Number(rule.auto_accept_threshold),
        counter_offer_range_pct: Number(rule.counter_offer_range_pct || 0), max_rounds: Number(rule.max_rounds || 1),
        quantity_discount_rules: rule.quantity_discount_rules.filter((x) => x.min_qty && x.discount_pct)
          .map((x) => ({ min_qty: Number(x.min_qty), discount_pct: Number(x.discount_pct) })),
      });
      onToast?.(t('Saved'));
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const respond = async (o, action) => {
    setBusy(o.id);
    try {
      await respondOffer(o.id, action, action === 'counter' ? Number(counters[o.id]) : undefined);
      onToast?.(action === 'accept' ? t('Accepted — the buyer can now buy at this price') : action === 'reject' ? t('Offer declined') : t('Your price was sent to the buyer'));
      loadOffers();
    } catch (err) { onToast?.(err.message, 'error'); } finally { setBusy(null); }
  };

  const pending = (offers || []).filter((o) => o.status === 'pending' && o.offered_by === 'buyer');
  const history = (offers || []).filter((o) => !(o.status === 'pending' && o.offered_by === 'buyer'));
  const tiers = rule.quantity_discount_rules || [];

  return (
    <div>
      <PageHeader title={t('Price offers')} subtitle={t('Buyers can ask for a lower price. Set your limit once — offers inside it are answered for you.')} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'offers', label: t('Waiting for you'), count: pending.length }, { key: 'rules', label: t('My bargaining limits') }, { key: 'history', label: t('Past offers') }]} />

      {tab === 'offers' && (offersError ? <LoadError message={offersError} onRetry={loadOffers} /> : offers === null ? <Loading /> : pending.length === 0 ? (
        <Empty icon="sell" title={t('No offers waiting')}>{t('Offers inside your limits are answered automatically.')}</Empty>
      ) : (
        <div className="space-y-3">
          {pending.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex justify-between gap-2">
                <p className="text-body-md">{t('{buyer} offers {price} each for {qty} × {product}', { buyer: o.buyer_name || t('A buyer'), price: inr(o.offered_price), qty: o.quantity, product: o.product_name })}</p>
                <span className="text-label-sm text-on-surface-variant whitespace-nowrap">{timeAgo(o.created_at)}</span>
              </div>
              <p className="text-label-md text-on-surface-variant">{t('Your price')} {inr(o.listed_price)}{o.message ? ` · “${o.message}”` : ''}</p>
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <Button icon="check" disabled={busy === o.id} onClick={() => respond(o, 'accept')}>{t('Accept {price}', { price: inr(o.offered_price) })}</Button>
                <Button variant="secondary" disabled={busy === o.id} onClick={() => respond(o, 'reject')}>{t('Say no')}</Button>
              </div>
              <div className="flex gap-2 mt-2 items-center">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-on-surface-variant">₹</span>
                  <input type="number" inputMode="decimal" placeholder={t('Your price')} value={counters[o.id] || ''} onChange={(e) => setCounters({ ...counters, [o.id]: e.target.value })}
                    className={`${inputClass} pl-7 w-36`} aria-label={t('Offer a different price')} />
                </div>
                <Button variant="outline" disabled={!counters[o.id] || busy === o.id} onClick={() => respond(o, 'counter')}>{t('Offer this price')}</Button>
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === 'rules' && (
        <Card className="p-5 max-w-2xl space-y-4">
          <Field label={t('Product')}>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{t('Choose a product…')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {inr(p.price)}</option>)}
            </Select>
          </Field>
          {product && (
            <>
              <div>
                <p className="text-title-sm font-semibold text-on-surface">{t('How much discount can you give?')}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PRESETS.map((p) => (
                    <button key={p} type="button" onClick={() => setRule({ ...rule, ...fromPreset(product.price, p) })} aria-pressed={pct === p || (p === 0 && !rule.enabled)}
                      className={`h-11 px-4 rounded-full border text-label-md ${pct === p || (p === 0 && !rule.enabled) ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface'}`}>
                      {p === 0 ? t('No bargaining') : t('Up to {n}% off', { n: p })}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-body-md bg-surface-container-low rounded-lg px-4 py-3">
                {!rule.enabled ? t('Buyers pay your price of {price}. They cannot bargain.', { price: inr(product.price) }) : (
                  <>
                    {t('Your price is {price}. Buyers can offer down to {min}.', { price: inr(product.price), min: inr(rule.min_price || 0) })}{' '}
                    {rule.auto_accept_threshold !== '' && t('Offers of {auto} or more are accepted automatically.', { auto: inr(rule.auto_accept_threshold) })}{' '}
                    {t('Lower offers come to you to decide.')}
                  </>
                )}
              </p>
              <details className="border border-outline-variant rounded-lg px-4 py-2">
                <summary className="text-label-md text-primary font-medium cursor-pointer py-1">{t('Advanced')}</summary>
                <div className="space-y-3 mt-2 mb-2">
                  <Toggle label={t('Allow buyers to bargain')} checked={rule.enabled} onChange={(v) => setRule({ ...rule, enabled: v })} />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label={t('Lowest price you accept (₹)')} hint={t('Buyers never see this number.')}><Input type="number" inputMode="decimal" value={rule.min_price} onChange={(e) => setRule({ ...rule, min_price: e.target.value })} /></Field>
                    <Field label={t('Accept at once at or above (₹)')} hint={t('Leave empty to decide every offer yourself.')}><Input type="number" inputMode="decimal" value={rule.auto_accept_threshold} onChange={(e) => setRule({ ...rule, auto_accept_threshold: e.target.value })} /></Field>
                    <Field label={t('Reply with my lowest price when an offer is this close (%)')}>
                      <Input type="number" inputMode="numeric" min="0" max="100" value={rule.counter_offer_range_pct} onChange={(e) => setRule({ ...rule, counter_offer_range_pct: e.target.value })} />
                    </Field>
                    <Field label={t('How many times one buyer can offer')}><Input type="number" inputMode="numeric" min="1" max="10" value={rule.max_rounds} onChange={(e) => setRule({ ...rule, max_rounds: e.target.value })} /></Field>
                  </div>
                  <p className="text-label-md font-medium">{t('Extra discount for bulk buyers')}</p>
                  {tiers.map((x, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input type="number" inputMode="numeric" placeholder={t('Buy at least (pieces)')} value={x.min_qty} onChange={(e) => setRule({ ...rule, quantity_discount_rules: tiers.map((y, j) => (j === i ? { ...y, min_qty: e.target.value } : y)) })} />
                      <Input type="number" inputMode="numeric" placeholder={t('Extra % off')} value={x.discount_pct} onChange={(e) => setRule({ ...rule, quantity_discount_rules: tiers.map((y, j) => (j === i ? { ...y, discount_pct: e.target.value } : y)) })} />
                      <button onClick={() => setRule({ ...rule, quantity_discount_rules: tiers.filter((_, j) => j !== i) })} aria-label={t('Remove')} className="h-11 w-11 flex-shrink-0 flex items-center justify-center text-on-surface-variant"><Icon name="delete" /></button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" icon="add" onClick={() => setRule({ ...rule, quantity_discount_rules: [...tiers, { min_qty: '', discount_pct: '' }] })}>{t('Add bulk discount')}</Button>
                </div>
              </details>
              <div className="flex justify-end"><Button size="lg" icon="check" onClick={save}>{t('Save')}</Button></div>
            </>
          )}
        </Card>
      )}

      {tab === 'history' && (offers === null ? <Loading /> : history.length === 0 ? <Empty icon="history" title={t('No past offers yet')} /> : (
        <Card className="divide-y divide-outline-variant/60">
          {history.map((o) => (
            <div key={o.id} className="p-3 flex justify-between gap-2 text-body-md">
              <span>{o.offered_by === 'buyer' ? (o.buyer_name || t('Buyer')) : t('You')} · {inr(o.offered_price)} × {o.quantity} · {o.product_name}</span>
              <Badge tone={o.status === 'accepted' ? 'green' : o.status === 'rejected' ? 'red' : 'slate'}>{statusText(o.status)}{o.fulfilled_order_id ? ` · ${t('ordered')}` : ''}</Badge>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
