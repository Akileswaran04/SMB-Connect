
import { useState, useEffect, useCallback } from 'react';
import { discover } from '../../../services/storage';
import CompareModal from './CompareModal';

export default function DiscoverPage({ onOpenProduct }) {
  const [filters, setFilters] = useState({ category: '', budget: '', q: '' });
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'general', 'grocery', 'clothing', 'electronics', 'home_kitchen',
    'beauty', 'food_beverages', 'handicrafts', 'manufacturing', 'retail', 'services',
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.budget) params.budget = Number(filters.budget);
      if (filters.q) params.q = filters.q;
      const data = await discover(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const trustBadge = (score) => {
    if (score === null || score === undefined) return null;
    const color = score >= 70 ? 'bg-emerald-100 text-emerald-800'
      : score >= 40 ? 'bg-amber-100 text-amber-800'
      : 'bg-red-100 text-red-700';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-semibold ${color}`}>
        <span className="material-symbols-outlined text-[12px]">verified</span>
        Trust {Math.round(score)}
      </span>
    );
  };

  const verifiedBadge = (status) =>
    status === 'verified' && (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-label-sm font-medium">
        <span className="material-symbols-outlined text-[12px]">badge</span>
        Verified
      </span>
    );

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 space-y-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products or sellers..."
            className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c.replace('_', ' ').toUpperCase()}</option>)}
          </select>
          <input
            type="number"
            min="0"
            value={filters.budget}
            onChange={(e) => setFilters({ ...filters, budget: e.target.value })}
            placeholder="Max budget ($)"
            className="h-10 px-3 w-40 rounded-lg border border-outline-variant bg-surface text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
          <button
            onClick={load}
            className="h-10 px-5 rounded-lg bg-primary text-on-primary text-label-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Search
          </button>
          <button
            onClick={() => { setCompareMode(!compareMode); setSelectedIds([]); }}
            className={`h-10 px-4 rounded-lg text-label-md flex items-center gap-2 border ${compareMode ? 'bg-primary-container/30 border-primary text-primary' : 'border-outline-variant text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
            Compare
          </button>
        </div>
        <p className="text-label-sm text-on-surface-variant">
          {total} result{total === 1 ? '' : 's'}
          {compareMode && ` · select 2-3 to compare (${selectedIds.length} selected)`}
        </p>
      </div>

      {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant animate-pulse">sync</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => {
            const selected = selectedIds.includes(p.id);
            const toggleSelect = () => {
              setSelectedIds((prev) =>
                selected ? prev.filter((id) => id !== p.id) : prev.length < 3 ? [...prev, p.id] : prev
              );
            };
            return (
              <button
                key={p.id}
                onClick={() => (compareMode ? toggleSelect() : onOpenProduct(p))}
                className={`relative text-left bg-surface-container-lowest rounded-xl border overflow-hidden hover:shadow-md transition-shadow flex flex-col ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant'}`}
              >
                {compareMode && (
                  <span className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest border border-outline-variant'}`}>
                    {selected && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </span>
                )}
                <div className="h-32 bg-surface-container flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">inventory_2</span>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1 flex-1">
                  <p className="text-label-md text-on-surface font-semibold truncate">{p.name}</p>
                  <p className="text-title-lg text-primary font-bold">${p.price?.toLocaleString()}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {trustBadge(p.trust_score)}
                    {verifiedBadge(p.seller_verification_status)}
                  </div>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    {p.seller_name}{p.seller_city ? ` · ${p.seller_city}` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[56px] opacity-30">search_off</span>
          <p className="text-body-md mt-3">No products match your filters. Try widening the search.</p>
        </div>
      )}

      {compareMode && selectedIds.length >= 2 && (
        <button
          onClick={() => setShowCompare(true)}
          className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 h-12 px-6 rounded-full bg-primary text-on-primary text-label-md font-medium shadow-lg flex items-center gap-2 z-30"
        >
          <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
          Compare {selectedIds.length}
        </button>
      )}

      {showCompare && (
        <CompareModal productIds={selectedIds} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}