/**
 * CompareModal — smart comparison of 2-3 buyer-selected products (PRD §17).
 * AI writes the summary; the table itself is computed server-side for accuracy.
 */
import { useState, useEffect } from 'react';
import { compareProducts } from '../../../services/storage';

export default function CompareModal({ productIds, onClose }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    compareProducts(productIds)
      .then((data) => { if (!cancelled) setResult(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not compare these products'); });
    return () => { cancelled = true; };
  }, [productIds]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-headline-sm text-on-surface font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">compare_arrows</span>
            Compare
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{error}</div>}

        {!result && !error && (
          <div className="flex justify-center py-10">
            <span className="material-symbols-outlined animate-pulse text-[32px] text-on-surface-variant">sync</span>
          </div>
        )}

        {result && (
          <>
            <p className="text-body-md text-on-surface bg-primary-container/20 rounded-xl p-3 mb-4">{result.summary}</p>
            <div className="space-y-2">
              {result.table.map((row) => (
                <div key={row.product_id} className="flex items-center justify-between p-3 rounded-lg border border-outline-variant">
                  <div>
                    <p className="text-label-md text-on-surface font-semibold">{row.name}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {row.trust_score != null ? `Trust ${Math.round(row.trust_score)}` : 'No trust score yet'} · {row.stock} in stock
                    </p>
                  </div>
                  <p className="text-title-md text-primary font-bold">${row.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
