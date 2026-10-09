/**
 * Catalogue — "Let me explore" (PRD §12–13). Normal commerce browsing:
 * categories, keyword search, filters and sorting. Longer, natural
 * requests ("comfortable black shoes under 1500") are turned into filters
 * by the AI and shown as chips, then behave like normal search.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { searchCatalogue, naturalSearch, getCategories } from '../../../services/smb';
import CompareModal from './CompareModal';
import { Icon, Badge, Button, Loading, Empty, ErrorNote, inputClass } from '../../../components/ui';
import { inr, deliveryText, titleCase } from '../../../utils/format';

const SORTS = [
  { key: 'relevance', label: 'Relevance' }, { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' }, { key: 'rating', label: 'Top rated' },
  { key: 'fastest', label: 'Fastest delivery' }, { key: 'newest', label: 'Newest' },
];
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
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [submitted, filters]);

  useEffect(() => { load(); }, [load]);

  const setF = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const activeCount = useMemo(() => Object.entries(filters).filter(([k, v]) => v && v !== EMPTY[k]).length, [filters]);
  const toggleCompare = (id) => setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3)));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-headline-md text-on-surface font-semibold">Catalogue</h1>
        <p className="text-body-md text-on-surface-variant">Browse everything, or search in your own words.</p>
      </div>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }}>
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-2.5 text-on-surface-variant" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products — e.g. black formal shoes under 1500"
            aria-label="Search products" className={`${inputClass} h-11 pl-10`} />
        </div>
        <Button type="submit" size="lg">Search</Button>
        <Button variant="secondary" size="lg" icon="tune" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <span className="hidden sm:inline">Filters</span>{activeCount > 0 && <Badge tone="primary">{activeCount}</Badge>}
        </Button>
      </form>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {[{ name: '' }, ...categories].map((c) => (
          <button key={c.name || 'all'} onClick={() => setF('category', c.name)}
            className={`h-9 px-4 rounded-full border text-label-md whitespace-nowrap inline-flex items-center gap-1.5 ${filters.category === c.name ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'}`}>
            {c.icon && <Icon name={c.icon} size={16} />}{c.name || 'All'}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-label-sm text-on-surface-variant">Sort
            <select value={filters.sort} onChange={(e) => setF('sort', e.target.value)} className={`${inputClass} mt-1`}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-label-sm text-on-surface-variant">Min price (₹)
            <input type="number" min="0" value={filters.min_price} onChange={(e) => setF('min_price', e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-label-sm text-on-surface-variant">Max price (₹)
            <input type="number" min="0" value={filters.budget} onChange={(e) => setF('budget', e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-label-sm text-on-surface-variant">Delivery
            <select value={filters.max_delivery_days} onChange={(e) => setF('max_delivery_days', e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Any time</option><option value="1">By tomorrow</option><option value="2">Within 2 days</option>
              <option value="3">Within 3 days</option><option value="5">Within 5 days</option>
            </select>
          </label>
          <label className="text-label-sm text-on-surface-variant">Size
            <input value={filters.size} onChange={(e) => setF('size', e.target.value)} placeholder="e.g. 9 or M" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-label-sm text-on-surface-variant">Colour
            <input value={filters.color} onChange={(e) => setF('color', e.target.value)} placeholder="e.g. black" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-label-sm text-on-surface-variant">Seller
            <select value={filters.seller_id} onChange={(e) => setF('seller_id', e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">All sellers</option>
              {Object.entries(sellers).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-label-md text-on-surface">
            <input type="checkbox" checked={filters.in_stock} onChange={(e) => setF('in_stock', e.target.checked)} className="w-4 h-4 accent-primary" />
            In stock only
          </label>
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>Clear filters</Button>
          </div>
        </div>
      )}

      {interpreted && (
        <div className="flex flex-wrap items-center gap-1.5 text-label-sm text-on-surface-variant">
          <Icon name="auto_awesome" size={16} className="text-primary" /> Searching for
          {Object.entries(interpreted.filters || {}).map(([k, v]) => (
            <Badge key={k} tone="primary">{k === 'budget' ? `under ${inr(v)}` : k === 'sort' ? titleCase(String(v)) : `${k === 'q' ? '' : `${k}: `}${v}`}</Badge>
          ))}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>
      {data && <p className="text-label-sm text-on-surface-variant">{data.total} product{data.total === 1 ? '' : 's'}</p>}

      {!data && loading ? <Loading /> : data?.items?.length === 0 ? (
        <Empty icon="search_off" title="No products match">Try fewer filters or different words.</Empty>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(data?.items || []).map((p) => (
            <article key={p.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col">
              <button onClick={() => onOpenProduct({ id: p.id })} className="block h-36 bg-surface-container relative">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  : <Icon name="inventory_2" size={36} className="text-on-surface-variant/40" />}
                {p.discount_pct > 0 && <Badge tone="green" className="absolute top-2 left-2">{p.discount_pct}% off</Badge>}
                {p.stock === 0 && <span className="absolute inset-0 bg-white/60 flex items-center justify-center text-label-md font-semibold text-on-surface">Out of stock</span>}
              </button>
              <div className="p-3 flex flex-col gap-0.5 flex-1">
                <button onClick={() => onOpenProduct({ id: p.id })} className="text-left text-label-md font-semibold text-on-surface line-clamp-2">{p.name}</button>
                <p className="text-label-sm text-on-surface-variant truncate">
                  {p.seller_name}{p.seller_verification_status === 'verified' ? ' ✓' : ''}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-title-md font-bold text-on-surface">{inr(p.price)}</span>
                  {p.listed_price > p.price && <span className="text-label-sm line-through text-on-surface-variant">{inr(p.listed_price)}</span>}
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  {p.rating ? `${p.rating}★ (${p.rating_count}) · ` : ''}{deliveryText(p.delivery_days)}
                </p>
                {p.sizes?.length > 0 && <p className="text-label-sm text-on-surface-variant">Sizes {p.sizes.join(', ')}</p>}
                <label className="mt-auto pt-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCompare(p.id)} className="accent-primary" />
                  Compare
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      {data?.next_cursor && (
        <div className="text-center"><Button variant="secondary" onClick={() => load(data.next_cursor)} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</Button></div>
      )}

      {compare.length >= 2 && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-30">
          <Button size="lg" icon="compare_arrows" className="shadow-lg" onClick={() => setShowCompare(true)}>Compare {compare.length} products</Button>
        </div>
      )}
      {showCompare && <CompareModal productIds={compare} onClose={() => setShowCompare(false)} onOpenProduct={(id) => { setShowCompare(false); onOpenProduct({ id }); }} />}
    </div>
  );
}
