/** Seller products (PRD §32): catalogue list with add, edit, archive/restore and delete. */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { listMyProducts, updateProduct, deleteProduct } from '../../services/smb';
import ProductEditor from './ProductEditor';
import { PageHeader, Button, Card, StatusBadge, Loading, Empty, Icon, Tabs, inputClass } from '../../components/ui';
import { inr } from '../../utils/format';
import { TAB_KEYS } from '../MODULES';

export default function ProductsTab({ onToast, go }) {
  const [products, setProducts] = useState(null);
  const [editing, setEditing] = useState(null); // product | 'new'
  const [status, setStatus] = useState('published');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setProducts((await listMyProducts().catch(() => ({ items: [] }))).items);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (products || []).filter((p) => (status === 'all' || p.status === status)
    && (!q || `${p.name} ${p.sku || ''} ${p.category}`.toLowerCase().includes(q.toLowerCase()))), [products, status, q]);
  const count = (s) => (products || []).filter((p) => p.status === s).length;

  const setState = async (p, next) => {
    try {
      await updateProduct(p.id, { status: next });
      onToast?.(next === 'archived' ? 'Archived — hidden from buyers' : 'Restored to the catalogue');
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.name}”? Products with orders are archived instead.`)) return;
    try {
      const r = await deleteProduct(p.id);
      onToast?.(r.archived ? 'This product has orders, so it was archived instead' : 'Product deleted');
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Products" subtitle="Your catalogue, pricing and product details."
        actions={<Button icon="add" onClick={() => setEditing('new')}>Add product</Button>} />
      <Tabs value={status} onChange={setStatus} tabs={[
        { key: 'published', label: 'Live', count: count('published') }, { key: 'archived', label: 'Archived', count: count('archived') },
        { key: 'deleted', label: 'Removed by admin', count: count('deleted') }, { key: 'all', label: 'All', count: products?.length },
      ]} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, SKU or category" aria-label="Search products" className={`${inputClass} mb-4 max-w-md`} />
      {products === null ? <Loading /> : shown.length === 0 ? (
        <Empty icon="inventory_2" title="No products here">{status === 'published' && 'Add your first product to start selling.'}</Empty>
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
                  {p.stock} available{p.reserved_stock ? ` · ${p.reserved_stock} held` : ''}{p.variants.length ? ` · ${p.variants.length} variants` : ''}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.status !== 'deleted' && <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>Edit</Button>}
                  {p.status === 'published' && <Button size="sm" variant="ghost" onClick={() => setState(p, 'archived')}>Archive</Button>}
                  {p.status === 'archived' && <Button size="sm" variant="ghost" onClick={() => setState(p, 'published')}>Restore</Button>}
                  <Button size="sm" variant="ghost" onClick={() => go(TAB_KEYS.NEGOTIATION, { productId: p.id })}>Negotiation</Button>
                  {p.status !== 'deleted' && <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label="Delete"><Icon name="delete" size={16} /></Button>}
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
