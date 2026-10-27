/**
 * Shop — "Let me explore" (PRD §12–13). Normal commerce browsing:
 * categories, keyword search, filters and sorting. Longer, natural
 * requests ("comfortable black shoes under 1500") are turned into filters
 * by the AI and shown as chips, then behave like normal search.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { searchCatalogue, naturalSearch, getCategories } from '../../../services/smb';
import CompareModal from './CompareModal';
import { Icon, Badge, Button, Skeleton, Empty, LoadError, inputClass } from '../../../components/ui';
import { inr, deliveryText, titleCase } from '../../../utils/format';
import { t } from '../../../i18n';

const SORTS = [
  { key: 'relevance', label: 'Best match' }, { key: 'price_asc', label: 'Cheapest first' },
  { key: 'price_desc', label: 'Costliest first' }, { key: 'rating', label: 'Best rated' },
  { key: 'fastest', label: 'Fastest delivery' }, { key: 'newest', label: 'Newest' },
];
const COLOURS = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'brown', 'grey', 'pink', 'gold', 'silver'];
const FILTER_NAMES = { q: '', category: 'Category', color: 'Colour', size: 'Size', min_price: 'From', seller_id: 'Seller', max_delivery_days: 'Delivery within (days)' };
const EMPTY = { category: '', sort: 'relevance', min_price: '', budget: '', in_stock: true, max_delivery_days: '', size: '', color: '', seller_id: '' };

const isNatural = (q) => q.trim().split(/\s+/).length >= 3 || /\d/.test(q) || /under|below|kulla|venum|within/i.test(q);

export default function CataloguePage({ onOpenProduct }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [interpreted, setInterpreted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [compare, setCompare] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [sellers, setSellers] = useState({});

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  const load = useCallback(async (cursor) => {
    setLoading(true);
    setError('');
    try {
      let result;
      if (submitted && isNatural(submitted) && !cursor) {
        result = await naturalSearch(submitted, filters.sort !== 'relevance' ? filters.sort : undefined);
        setInterpreted(result.interpreted);
      } else {
        setInterpreted(null);
        result = await searchCatalogue({ ...filters, q: submitted || undefined, cursor, limit: 24 });
      }
      setData((prev) => (cursor && prev ? { ...result, items: [...prev.items, ...result.items] } : result));
      setSellers((prev) => {
        const next = { ...prev };
        result.items.forEach((i) => { next[i.seller_id] = i.seller_name; });
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [submitted, filters]);

  useEffect(() => { load(); }, [load]);

  const setF = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const activeCount = useMemo(() => Object.entries(filters).filter(([k, v]) => v && v !== EMPTY[k]).length, [filters]);
  const sizes = useMemo(() => [...new Set((data?.items || []).flatMap((p) => p.sizes || []))].slice(0, 16), [data]);
  const toggleCompare = (id) => setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3)));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-headline-md text-on-surface font-semibold">{t('Shop')}</h1>
        <p className="text-body-md text-on-surface-variant">{t('Look through everything, or search in your own words.')}</p>
      </div>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }}>
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 text-on-surface-variant" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search, e.g. black shoes under 1500')}
            aria-label={t('Search')} className={`${inputClass} h-11 pl-10`} />
        </div>
        <Button type="submit" size="lg" icon="search" aria-label={t('Search')}><span className="hidden sm:inline">{t('Search')}</span></Button>
        <Button variant="secondary" size="lg" icon="tune" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          {t('Filter')}{activeCount > 0 && <Badge tone="primary">{activeCount}</Badge>}
        </Button>
      </form>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {[{ name: '' }, ...categories].map((c) => (
          <button key={c.name || 'all'} onClick={() => setF('category', c.name)}
            className={`h-11 px-4 rounded-full border text-label-md whitespace-nowrap inline-flex items-center gap-1.5 ${filters.category === c.name ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'}`}>
            {c.icon && <Icon name={c.icon} size={18} />}{c.name || t('All')}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-label-md text-on-surface-variant">{t('Show first')}
            <select value={filters.sort} onChange={(e) => setF('sort', e.target.value)} className={`${inputClass} mt-1`}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
            </select>
          </label>
          <label className="text-label-md text-on-surface-variant">{t('Lowest price (₹)')}
            <input type="number" inputMode="numeric" min="0" value={filters.min_price} onChange={(e) => setF('min_price', e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-label-md text-on-surface-variant">{t('Highest price (₹)')}
            <input type="number" inputMode="numeric" min="0" value={filters.budget} onChange={(e) => setF('budget', e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-label-md text-on-surface-variant">{t('Delivery')}
            <select value={filters.max_delivery_days} onChange={(e) => setF('max_delivery_days', e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{t('Any time')}</option><option value="1">{t('By tomorrow')}</option><option value="2">{t('Within {n} days', { n: 2 })}</option>
              <option value="3">{t('Within {n} days', { n: 3 })}</option><option value="5">{t('Within {n} days', { n: 5 })}</option>
            </select>
          </label>
          <label className="text-label-md text-on-surface-variant">{t('Colour')}
            <select value={filters.color} onChange={(e) => setF('color', e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{t('Any colour')}</option>
              {COLOURS.map((c) => <option key={c} value={c}>{t(titleCase(c))}</option>)}
            </select>
          </label>
          <label className="text-label-md text-on-surface-variant">{t('Seller')}
            <select value={filters.seller_id} onChange={(e) => setF('seller_id', e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{t('All sellers')}</option>
              {Object.entries(sellers).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-label-md text-on-surface">
            <input type="checkbox" checked={filters.in_stock} onChange={(e) => setF('in_stock', e.target.checked)} className="w-5 h-5 accent-primary" />
            {t('Only items in stock')}
          </label>
          {sizes.length > 0 && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-label-md text-on-surface-variant mb-1">{t('Size')}</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button key={s} type="button" onClick={() => setF('size', filters.size === s ? '' : s)} aria-pressed={filters.size === s}
                    className={`min-w-11 h-11 px-3 rounded-lg border text-label-md ${filters.size === s ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface'}`}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <Button variant="ghost" onClick={() => setFilters(EMPTY)}>{t('Clear all')}</Button>
          </div>
        </div>
      )}

      {interpreted && (
        <div className="flex flex-wrap items-center gap-1.5 text-label-sm text-on-surface-variant">
          <Icon name="auto_awesome" size={18} className="text-primary" /> {t('Searching for')}
          {Object.entries(interpreted.filters || {}).map(([k, v]) => (
            <Badge key={k} tone="primary">{k === 'budget' ? t('Under {amount}', { amount: inr(v) }) : k === 'sort' ? t(SORTS.find((s) => s.key === v)?.label || titleCase(String(v))) : `${FILTER_NAMES[k] ? `${t(FILTER_NAMES[k])}: ` : ''}${v}`}</Badge>
          ))}
        </div>
      )}

      {data && !error && <p className="text-label-md text-on-surface-variant">{t('{n} products', { n: data.total })}</p>}

      {error && !data ? <LoadError message={error} onRetry={() => load()} /> : !data && loading ? <Skeleton count={8} /> : data?.items?.length === 0 ? (
        <Empty icon="search_off" title={t('Nothing found')} action={activeCount > 0 && <Button variant="secondary" onClick={() => setFilters(EMPTY)}>{t('Clear all filters')}</Button>}>{t('Try fewer filters or other words.')}</Empty>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(data?.items || []).map((p) => (
            <article key={p.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col">
              <button onClick={() => onOpenProduct({ id: p.id })} className="block h-36 bg-surface-container relative">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  : <Icon name="inventory_2" size={36} className="text-on-surface-variant/40" />}
                {p.discount_pct > 0 && <Badge tone="green" className="absolute top-2 left-2">{t('{n}% off', { n: p.discount_pct })}</Badge>}
                {p.stock === 0 && <span className="absolute inset-0 bg-white/60 flex items-center justify-center text-label-md font-semibold text-on-surface">{t('Out of stock')}</span>}
              </button>
              <div className="p-3 flex flex-col gap-0.5 flex-1">
                <button onClick={() => onOpenProduct({ id: p.id })} className="text-left text-label-md font-semibold text-on-surface line-clamp-2">{p.name}</button>
                <p className="text-label-sm text-on-surface-variant truncate">
                  {p.seller_name}{p.seller_verification_status === 'verified' ? ` · ✓ ${t('Verified')}` : ''}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-title-md font-bold text-on-surface">{inr(p.price)}</span>
                  {p.listed_price > p.price && <span className="text-label-sm line-through text-on-surface-variant">{inr(p.listed_price)}</span>}
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  {p.rating ? `${p.rating}★ (${p.rating_count}) · ` : ''}{deliveryText(p.delivery_days)}
                </p>
                {p.sizes?.length > 0 && <p className="text-label-sm text-on-surface-variant">{t('Sizes')} {p.sizes.join(', ')}</p>}
                <label className="mt-auto pt-2 min-h-10 flex items-center gap-2 text-label-sm text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCompare(p.id)} className="w-5 h-5 accent-primary" />
                  {t('Compare')}
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      {data?.next_cursor && (
        <div className="text-center"><Button variant="secondary" onClick={() => load(data.next_cursor)} disabled={loading}>{loading ? t('Loading…') : t('Show more')}</Button></div>
      )}

      {compare.length >= 2 && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-30">
          <Button size="lg" icon="compare_arrows" className="shadow-lg" onClick={() => setShowCompare(true)}>{t('Compare {n} products', { n: compare.length })}</Button>
        </div>
      )}
      {showCompare && <CompareModal productIds={compare} onClose={() => setShowCompare(false)} onOpenProduct={(id) => { setShowCompare(false); onOpenProduct({ id }); }} />}
    </div>
  );
}
