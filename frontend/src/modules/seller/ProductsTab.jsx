/** Seller products (PRD §32): catalogue list with add, edit, archive/restore and delete. */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { listMyProducts, updateProduct, deleteProduct } from '../../services/smb';
import ProductEditor from './ProductEditor';
import { PageHeader, Button, Card, StatusBadge, Loading, LoadError, Empty, Icon, Tabs, inputClass } from '../../components/ui';
import { t } from '../../i18n';
import { inr } from '../../utils/format';
import { TAB_KEYS } from '../MODULES';

export default function ProductsTab({ onToast, go }) {
  const [products, setProducts] = useState(null);
  const [editing, setEditing] = useState(null); // product | 'new'
  const [status, setStatus] = useState('published');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setProducts((await listMyProducts()).items); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (products || []).filter((p) => (status === 'all' || p.status === status)
    && (!q || `${p.name} ${p.sku || ''} ${p.category}`.toLowerCase().includes(q.toLowerCase()))), [products, status, q]);
  const count = (s) => (products || []).filter((p) => p.status === s).length;

  const setState = async (p, next) => {
    try {
      await updateProduct(p.id, { status: next });
      onToast?.(next === 'archived' ? t('Hidden — buyers cannot see it now') : t('Showing to buyers again'));
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const remove = async (p) => {
    if (!window.confirm(t('Delete "{name}"? Products that already have orders will be hidden instead.', { name: p.name }))) return;
    try {
      const r = await deleteProduct(p.id);
      onToast?.(r.archived ? t('This product has orders, so it was hidden instead') : t('Product deleted'));
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title={t('Products')} subtitle={t('Everything you sell, with prices and photos.')}
        actions={<Button size="lg" icon="add" onClick={() => setEditing('new')}>{t('Add product')}</Button>} />
      <Tabs value={status} onChange={setStatus} tabs={[
        { key: 'published', label: t('Showing to buyers'), count: count('published') }, { key: 'archived', label: t('Hidden'), count: count('archived') },
        { key: 'deleted', label: t('Removed by SMBConnect'), count: count('deleted') }, { key: 'all', label: t('All'), count: products?.length },
      ]} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search your products')} aria-label={t('Search your products')} className={`${inputClass} mb-4 max-w-md`} />
      {error ? <LoadError message={error} onRetry={load} /> : products === null ? <Loading /> : shown.length === 0 ? (
        <Empty icon="inventory_2" title={t('No products here')}
          action={status === 'published' && !q && <Button size="lg" icon="add" onClick={() => setEditing('new')}>{t('Add your first product')}</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((p) => (
            <Card key={p.id} className="p-3 flex gap-3">
              <div className="w-20 h-20 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" className="text-on-surface-variant/40" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="text-label-md font-semibold text-on-surface truncate">{p.name}</p>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-label-sm text-on-surface-variant">{p.category}{p.sku ? ` · ${p.sku}` : ''}</p>
                <p className="text-label-md mt-0.5">
                  <strong>{inr(p.price_info.unit)}</strong>
                  {p.price_info.discount_pct > 0 && <span className="text-on-surface-variant line-through ml-1">{inr(p.price)}</span>}
                </p>
                <p className={`text-label-sm ${p.stock === 0 ? 'text-error' : p.stock <= p.low_stock_threshold ? 'text-amber-700' : 'text-on-surface-variant'}`}>
                  {p.stock === 0 ? t('Out of stock') : t('{n} in stock', { n: p.stock })}{p.reserved_stock ? ` · ${t('{n} on hold for orders', { n: p.reserved_stock })}` : ''}{p.variants.length ? ` · ${t('{n} sizes/colours', { n: p.variants.length })}` : ''}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.status !== 'deleted' && <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(p)}>{t('Edit')}</Button>}
                  {p.status === 'published' && <Button size="sm" variant="ghost" onClick={() => setState(p, 'archived')}>{t('Hide')}</Button>}
                  {p.status === 'archived' && <Button size="sm" variant="ghost" onClick={() => setState(p, 'published')}>{t('Show again')}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => go(TAB_KEYS.NEGOTIATION, { productId: p.id })}>{t('Bargaining')}</Button>
                  {p.status !== 'deleted' && <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label={t('Delete')}><Icon name="delete" size={20} /></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <ProductEditor product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onToast={onToast}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
