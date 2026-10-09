/**
 * Smart comparison (PRD §17): the AI summary and key differences first,
 * then a compact table of price, delivery, quality, reliability and stock.
 * Full specifications are one tap away.
 */
import { useState, useEffect } from 'react';
import { compareProducts } from '../../../services/smb';
import { Modal, Loading, ErrorNote, Icon, Badge } from '../../../components/ui';
import { inr, deliveryText } from '../../../utils/format';

const BEST = { price: 'Lowest price', delivery: 'Fastest', quality: 'Best reviewed', seller_reliability: 'Most trusted seller' };

export default function CompareModal({ productIds, onClose, onOpenProduct }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [specs, setSpecs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    compareProducts(productIds)
      .then((d) => !cancelled && setResult(d))
      .catch((e) => !cancelled && setError(e.message || 'Could not compare these products'));
    return () => { cancelled = true; };
  }, [productIds]);

  const badgesFor = (id) => Object.entries(result?.best_for || {}).filter(([, pid]) => pid === id).map(([k]) => BEST[k]);

  return (
    <Modal open onClose={onClose} title="Compare" wide>
      <ErrorNote>{error}</ErrorNote>
      {!result && !error && <Loading label="Comparing…" />}
      {result && (
        <div className="space-y-4">
          <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-4">
            <p className="text-label-sm text-primary font-semibold flex items-center gap-1"><Icon name="auto_awesome" size={16} /> In short</p>
            <p className="text-body-md text-on-surface mt-1">{result.summary}</p>
          </div>
          {result.differences?.length > 0 && (
            <ul className="space-y-1">
              {result.differences.map((d) => (
                <li key={d} className="text-label-md text-on-surface-variant flex gap-1.5"><Icon name="arrow_right" size={18} />{d}</li>
              ))}
            </ul>
          )}
          <div className={`grid gap-3 ${result.table.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {result.table.map((row) => (
              <div key={row.product_id} className="border border-outline-variant rounded-xl p-3 space-y-1.5">
                <p className="text-title-sm font-semibold text-on-surface">{row.name}</p>
                <div className="flex flex-wrap gap-1">{badgesFor(row.product_id).map((b) => <Badge key={b} tone="green">{b}</Badge>)}</div>
                <p className="text-headline-sm font-bold text-on-surface">{inr(row.price)}</p>
                <p className="text-label-md text-on-surface-variant">{deliveryText(row.delivery_days)}{row.express_available ? ' · express available' : ''}</p>
                <p className="text-label-md text-on-surface-variant">Quality: {row.rating ? `${row.rating}★ (${row.rating_count})` : 'no reviews yet'}</p>
                <p className="text-label-md text-on-surface-variant">Seller: {row.seller_name}{row.verified_seller ? ' ✓' : ''}{row.trust_score != null ? ` · trust ${Math.round(row.trust_score)}` : ''}</p>
                <p className="text-label-md text-on-surface-variant">{row.stock > 0 ? `${row.stock} in stock` : 'Out of stock'}{row.sizes?.length ? ` · sizes ${row.sizes.join(', ')}` : ''}</p>
                {specs && Object.entries(row.specifications || {}).map(([k, v]) => (
                  <p key={k} className="text-label-sm text-on-surface"><span className="text-on-surface-variant">{k}:</span> {v}</p>
                ))}
                <button onClick={() => onOpenProduct?.(row.product_id)} className="text-label-md text-primary font-semibold">View product</button>
              </div>
            ))}
          </div>
          <button onClick={() => setSpecs((s) => !s)} className="text-label-md text-primary font-medium">
            {specs ? 'Hide full specifications' : 'Show full specifications'}
          </button>
        </div>
      )}
    </Modal>
  );
}
