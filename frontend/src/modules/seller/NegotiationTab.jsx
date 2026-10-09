/**
 * Seller negotiation (PRD §19, §35): per-product rules — on/off, minimum
 * price, auto-accept, counter-offer range, maximum rounds, quantity
 * discounts — and incoming offers to accept, reject or counter.
 */
import { useState, useEffect, useCallback } from 'react';
import { listMyProducts, getRule, saveRule, listOffers, respondOffer } from '../../services/smb';
import { PageHeader, Tabs, Card, Button, Loading, Empty, Field, Input, Select, Toggle, Badge, Icon, inputClass } from '../../components/ui';
import { inr, timeAgo, titleCase } from '../../utils/format';

const EMPTY_RULE = { enabled: true, min_price: '', auto_accept_threshold: '', counter_offer_range_pct: 10, max_rounds: 2, quantity_discount_rules: [] };

export default function NegotiationTab({ onToast, focus }) {
  const [tab, setTab] = useState(focus?.productId ? 'rules' : 'offers');
  const [offers, setOffers] = useState(null);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(focus?.productId || '');
  const [rule, setRule] = useState(EMPTY_RULE);
  const [counters, setCounters] = useState({});

  const loadOffers = useCallback(async () => setOffers(await listOffers().catch(() => [])), []);
  useEffect(() => {
    loadOffers();
    listMyProducts().then((r) => setProducts(r.items.filter((p) => p.status === 'published'))).catch(() => {});
  }, [loadOffers]);

  useEffect(() => {
    if (!productId) return;
    getRule(productId).then((r) => setRule(r ? { ...EMPTY_RULE, ...r, auto_accept_threshold: r.auto_accept_threshold ?? '' } : {
      ...EMPTY_RULE, min_price: Math.round((products.find((p) => p.id === Number(productId))?.price || 0) * 0.9),
    })).catch(() => setRule(EMPTY_RULE));
  }, [productId, products]);

  const product = products.find((p) => p.id === Number(productId));

  const save = async () => {
    try {
      await saveRule(productId, {
        enabled: rule.enabled, min_price: Number(rule.min_price),
        auto_accept_threshold: rule.auto_accept_threshold === '' ? null : Number(rule.auto_accept_threshold),
        counter_offer_range_pct: Number(rule.counter_offer_range_pct || 0), max_rounds: Number(rule.max_rounds || 1),
        quantity_discount_rules: rule.quantity_discount_rules.filter((t) => t.min_qty && t.discount_pct)
          .map((t) => ({ min_qty: Number(t.min_qty), discount_pct: Number(t.discount_pct) })),
      });
      onToast?.('Negotiation rules saved');
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const respond = async (o, action) => {
    try {
      await respondOffer(o.id, action, action === 'counter' ? Number(counters[o.id]) : undefined);
      onToast?.(action === 'accept' ? 'Offer accepted — the buyer can now check out at this price' : action === 'reject' ? 'Offer declined' : 'Counter-offer sent');
      loadOffers();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const pending = (offers || []).filter((o) => o.status === 'pending' && o.offered_by === 'buyer');
  const history = (offers || []).filter((o) => !(o.status === 'pending' && o.offered_by === 'buyer'));
  const tiers = rule.quantity_discount_rules || [];

  return (
    <div>
      <PageHeader title="Negotiation" subtitle="Set your price limits once; offers inside them are handled for you." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'offers', label: 'Offers', count: pending.length }, { key: 'rules', label: 'Rules' }, { key: 'history', label: 'History' }]} />

      {tab === 'offers' && (offers === null ? <Loading /> : pending.length === 0 ? <Empty icon="sell" title="No offers waiting" /> : (
        <div className="space-y-3">
          {pending.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex justify-between gap-2">
                <p className="text-label-md"><strong>{o.buyer_name || 'A buyer'}</strong> offers <strong>{inr(o.offered_price)}</strong> × {o.quantity} for {o.product_name}</p>
                <span className="text-label-sm text-on-surface-variant">{timeAgo(o.created_at)}</span>
              </div>
              <p className="text-label-sm text-on-surface-variant">Listed {inr(o.listed_price)} · round {o.round}{o.message ? ` · “${o.message}”` : ''}</p>
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <Button size="sm" onClick={() => respond(o, 'accept')}>Accept</Button>
                <Button size="sm" variant="secondary" onClick={() => respond(o, 'reject')}>Reject</Button>
                <input type="number" placeholder="Counter ₹" value={counters[o.id] || ''} onChange={(e) => setCounters({ ...counters, [o.id]: e.target.value })}
                  className={`${inputClass} h-8 w-32`} aria-label="Counter price" />
                <Button size="sm" variant="outline" disabled={!counters[o.id]} onClick={() => respond(o, 'counter')}>Counter</Button>
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === 'rules' && (
        <Card className="p-5 max-w-2xl space-y-4">
          <Field label="Product">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choose a product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {inr(p.price)}</option>)}
            </Select>
          </Field>
          {product && (
            <>
              <Toggle label="Allow buyers to negotiate" checked={rule.enabled} onChange={(v) => setRule({ ...rule, enabled: v })} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Listed price"><Input value={inr(product.price)} disabled /></Field>
                <Field label="Minimum acceptable (₹)" hint="Never shown to buyers except as the lowest price to try."><Input type="number" value={rule.min_price} onChange={(e) => setRule({ ...rule, min_price: e.target.value })} /></Field>
                <Field label="Auto-accept at or above (₹)" hint="Optional — accepted instantly."><Input type="number" value={rule.auto_accept_threshold} onChange={(e) => setRule({ ...rule, auto_accept_threshold: e.target.value })} /></Field>
                <Field label="Counter-offer range (%)" hint="Offers this close below your minimum get an automatic counter at your minimum.">
                  <Input type="number" min="0" max="100" value={rule.counter_offer_range_pct} onChange={(e) => setRule({ ...rule, counter_offer_range_pct: e.target.value })} />
                </Field>
                <Field label="Maximum offers per buyer"><Input type="number" min="1" max="10" value={rule.max_rounds} onChange={(e) => setRule({ ...rule, max_rounds: e.target.value })} /></Field>
              </div>
              <div>
                <p className="text-label-md font-medium">Quantity discounts <span className="text-on-surface-variant font-normal">(lower your minimum for bulk buyers)</span></p>
                {tiers.map((t, i) => (
                  <div key={i} className="flex gap-2 mt-2 items-center">
                    <Input type="number" placeholder="Min qty" value={t.min_qty} onChange={(e) => setRule({ ...rule, quantity_discount_rules: tiers.map((x, j) => (j === i ? { ...x, min_qty: e.target.value } : x)) })} />
                    <Input type="number" placeholder="Discount %" value={t.discount_pct} onChange={(e) => setRule({ ...rule, quantity_discount_rules: tiers.map((x, j) => (j === i ? { ...x, discount_pct: e.target.value } : x)) })} />
                    <button onClick={() => setRule({ ...rule, quantity_discount_rules: tiers.filter((_, j) => j !== i) })} aria-label="Remove" className="text-on-surface-variant"><Icon name="delete" /></button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" icon="add" onClick={() => setRule({ ...rule, quantity_discount_rules: [...tiers, { min_qty: '', discount_pct: '' }] })}>Add tier</Button>
              </div>
              <div className="flex justify-end"><Button onClick={save} disabled={!rule.min_price}>Save rules</Button></div>
            </>
          )}
        </Card>
      )}

      {tab === 'history' && (offers === null ? <Loading /> : history.length === 0 ? <Empty icon="history" title="No negotiation history yet" /> : (
        <Card className="divide-y divide-outline-variant/60">
          {history.map((o) => (
            <div key={o.id} className="p-3 flex justify-between gap-2 text-label-md">
              <span>{o.offered_by === 'buyer' ? (o.buyer_name || 'Buyer') : 'You'} · {inr(o.offered_price)} × {o.quantity} · {o.product_name}</span>
              <Badge tone={o.status === 'accepted' ? 'green' : o.status === 'rejected' ? 'red' : 'slate'}>{titleCase(o.status)}{o.fulfilled_order_id ? ' · ordered' : ''}</Badge>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
