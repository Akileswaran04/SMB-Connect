/**
 * Add / edit a product (PRD §32, §34): basics and images, pricing (listed,
 * sale, promotional, bulk tiers), SKU and stock, size/colour variants,
 * delivery and return information, and specifications. Stock changes on an
 * existing product go through Inventory so every change is logged.
 */
import { useState, useEffect } from 'react';
import { createProduct, updateProduct, addVariant, updateVariant, deleteVariant, getCategories } from '../../services/smb';
import { Modal, Button, Field, Input, Textarea, Toggle, Icon, ErrorNote } from '../../components/ui';

const blankVariant = { size: '', color: '', sku: '', price: '', stock: '' };
const MAX_IMAGE_BYTES = 1_000_000;

export default function ProductEditor({ product, onClose, onSaved, onToast }) {
  const editing = !!product;
  const [f, setF] = useState(() => ({
    name: product?.name || '', category: product?.category || '', description: product?.description || '',
    image_url: product?.image_url || '', images: (product?.images || []).join('\n'),
    price: product?.price ?? '', sale_price: product?.sale_price ?? '', promo_price: product?.promo_price ?? '',
    promo_ends_at: product?.promo_ends_at ? product.promo_ends_at.slice(0, 16) : '',
    sku: product?.sku || '', stock: product?.stock ?? 0, low_stock_threshold: product?.low_stock_threshold ?? 5,
    delivery_days: product?.delivery_days ?? 4, express_available: !!product?.express_available,
    return_days: product?.return_days ?? 7, return_policy: product?.return_policy || '',
  }));
  const [tiers, setTiers] = useState(product?.bulk_pricing || []);
  const [specs, setSpecs] = useState(Object.entries(product?.specifications || {}).map(([k, v]) => ({ k, v })));
  const [variants, setVariants] = useState((product?.variants || []).map((v) => ({ ...v, price: v.price ?? '' })));
  const [newVariants, setNewVariants] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) return setError('Please choose an image under 1 MB');
    const reader = new FileReader();
    reader.onload = (ev) => setF((x) => ({ ...x, image_url: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError('');
    if (!f.name.trim() || !f.category.trim() || !Number(f.price)) return setError('Name, category and price are required');
    if (f.sale_price && Number(f.sale_price) >= Number(f.price)) return setError('Sale price must be lower than the listed price');
    const payload = {
      name: f.name.trim(), category: f.category.trim(), description: f.description || null,
      image_url: f.image_url || null, images: f.images.split('\n').map((s) => s.trim()).filter(Boolean),
      price: Number(f.price), sale_price: num(f.sale_price), promo_price: num(f.promo_price),
      promo_ends_at: f.promo_ends_at ? new Date(f.promo_ends_at).toISOString() : null,
      bulk_pricing: tiers.filter((t) => t.min_qty && t.unit_price).map((t) => ({ min_qty: Number(t.min_qty), unit_price: Number(t.unit_price) })),
      sku: f.sku || null, low_stock_threshold: Number(f.low_stock_threshold || 0),
      delivery_days: Number(f.delivery_days || 1), express_available: f.express_available,
      return_days: Number(f.return_days || 0), return_policy: f.return_policy || null,
      specifications: Object.fromEntries(specs.filter((s) => s.k.trim() && s.v.trim()).map((s) => [s.k.trim(), s.v.trim()])),
    };
    const cleanVariant = (v) => ({ size: v.size || null, color: v.color || null, sku: v.sku || null, price: num(v.price) });
    setSaving(true);
    try {
      if (!editing) {
        const vs = newVariants.filter((v) => v.size || v.color).map((v) => ({ ...cleanVariant(v), stock: Number(v.stock || 0) }));
        await createProduct({ ...payload, stock: vs.length ? 0 : Number(f.stock || 0), variants: vs.length ? vs : null });
      } else {
        await updateProduct(product.id, payload);
        for (const id of removed) await deleteVariant(product.id, id);
        for (const v of variants) {
          const orig = product.variants.find((o) => o.id === v.id);
          const changed = ['size', 'color', 'sku', 'price'].some((k) => String(orig?.[k] ?? '') !== String(v[k] ?? ''));
          if (changed) await updateVariant(product.id, v.id, cleanVariant(v));
        }
        for (const v of newVariants.filter((x) => x.size || x.color)) {
          await addVariant(product.id, { ...cleanVariant(v), stock: Number(v.stock || 0) });
        }
      }
      onToast?.(editing ? 'Product updated' : 'Product added');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Could not save the product');
    } finally {
      setSaving(false);
    }
  };

  const hasVariants = variants.length + newVariants.length > 0;

  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${product.name}` : 'Add a product'} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save product'}</Button></>}>
      <div className="space-y-5">
        <ErrorNote>{error}</ErrorNote>
        <section className="grid sm:grid-cols-2 gap-3">
          <Field label="Product name *" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} placeholder="e.g. Black Formal Oxford Shoe" /></Field>
          <Field label="Category *">
            <Input list="cat-list" value={f.category} onChange={set('category')} placeholder="e.g. Footwear" />
            <datalist id="cat-list">{categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </Field>
          <Field label="SKU"><Input value={f.sku} onChange={set('sku')} placeholder="Your stock code" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} placeholder="What buyers should know" /></Field>
          <Field label="Main image" hint="Upload (under 1 MB) or paste an image URL.">
            <div className="flex gap-2 items-center">
              {f.image_url && <img src={f.image_url} alt="" className="w-10 h-10 rounded object-cover" />}
              <label className="h-10 px-3 rounded-lg border border-outline-variant text-label-md flex items-center gap-1 cursor-pointer"><Icon name="upload" size={18} />Upload<input type="file" accept="image/*" className="hidden" onChange={onImage} /></label>
            </div>
            <Input className="mt-2" value={f.image_url.startsWith('data:') ? '' : f.image_url} onChange={set('image_url')} placeholder="https://…" />
          </Field>
          <Field label="More image URLs" hint="One per line"><Textarea value={f.images} onChange={set('images')} /></Field>
        </section>

        <section>
          <h3 className="text-title-sm font-semibold mb-2">Pricing</h3>
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Listed price (₹) *"><Input type="number" min="1" value={f.price} onChange={set('price')} /></Field>
            <Field label="Sale price (₹)"><Input type="number" min="1" value={f.sale_price} onChange={set('sale_price')} /></Field>
            <Field label="Promo price (₹)"><Input type="number" min="1" value={f.promo_price} onChange={set('promo_price')} /></Field>
            <Field label="Promo ends"><Input type="datetime-local" value={f.promo_ends_at} onChange={set('promo_ends_at')} /></Field>
          </div>
          <p className="text-label-md font-medium mt-3">Bulk pricing</p>
          {tiers.map((t, i) => (
            <div key={i} className="flex gap-2 mt-2 items-center">
              <Input type="number" placeholder="Min qty" value={t.min_qty} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, min_qty: e.target.value } : x)))} />
              <Input type="number" placeholder="Unit price ₹" value={t.unit_price} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
              <button onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="Remove tier" className="text-on-surface-variant"><Icon name="delete" /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="add" onClick={() => setTiers([...tiers, { min_qty: '', unit_price: '' }])}>Add bulk tier</Button>
          <p className="text-label-sm text-on-surface-variant">Negotiation rules (floor, auto-accept, quantity discounts) are set on the Negotiation page.</p>
        </section>

        <section>
          <h3 className="text-title-sm font-semibold mb-2">Variants & stock</h3>
          {!hasVariants && (
            <div className="grid sm:grid-cols-2 gap-3 mb-2">
              <Field label="Stock" hint={editing ? 'Change stock from the Inventory page (every change is logged).' : null}>
                <Input type="number" min="0" value={f.stock} onChange={set('stock')} disabled={editing} />
              </Field>
              <Field label="Low-stock alert at"><Input type="number" min="0" value={f.low_stock_threshold} onChange={set('low_stock_threshold')} /></Field>
            </div>
          )}
          {hasVariants && (
            <div className="grid grid-cols-5 gap-2 text-label-sm text-on-surface-variant mb-1"><span>Size</span><span>Colour</span><span>SKU</span><span>Price (₹, optional)</span><span>Stock</span></div>
          )}
          {variants.map((v, i) => (
            <div key={v.id} className="grid grid-cols-5 gap-2 mb-2 items-center">
              <Input value={v.size || ''} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} />
              <Input value={v.color || ''} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
              <Input value={v.sku || ''} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} />
              <Input type="number" value={v.price} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <div className="flex items-center gap-1">
                <span className="text-label-md flex-1" title="Change from Inventory">{v.stock}{v.reserved_stock ? ` (+${v.reserved_stock} held)` : ''}</span>
                <button onClick={() => { setRemoved([...removed, v.id]); setVariants(variants.filter((_, j) => j !== i)); }} aria-label="Remove variant" className="text-on-surface-variant"><Icon name="delete" /></button>
              </div>
            </div>
          ))}
          {newVariants.map((v, i) => (
            <div key={`n${i}`} className="grid grid-cols-5 gap-2 mb-2 items-center">
              <Input placeholder="e.g. 9" value={v.size} onChange={(e) => setNewVariants(newVariants.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} />
              <Input placeholder="e.g. Black" value={v.color} onChange={(e) => setNewVariants(newVariants.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
              <Input value={v.sku} onChange={(e) => setNewVariants(newVariants.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} />
              <Input type="number" value={v.price} onChange={(e) => setNewVariants(newVariants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <div className="flex items-center gap-1">
                <Input type="number" min="0" value={v.stock} onChange={(e) => setNewVariants(newVariants.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))} />
                <button onClick={() => setNewVariants(newVariants.filter((_, j) => j !== i))} aria-label="Remove variant" className="text-on-surface-variant"><Icon name="delete" /></button>
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="add" onClick={() => setNewVariants([...newVariants, { ...blankVariant }])}>Add size / colour</Button>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <h3 className="text-title-sm font-semibold sm:col-span-3">Delivery & returns</h3>
          <Field label="Delivery time (days)"><Input type="number" min="1" value={f.delivery_days} onChange={set('delivery_days')} /></Field>
          <Field label="Return window (days)"><Input type="number" min="0" value={f.return_days} onChange={set('return_days')} /></Field>
          <div className="flex items-end"><Toggle label="Express next-day delivery" checked={f.express_available} onChange={(v) => setF((x) => ({ ...x, express_available: v }))} /></div>
          <Field label="Return policy" className="sm:col-span-3"><Input value={f.return_policy} onChange={set('return_policy')} placeholder="e.g. Unworn, with tags, within 10 days" /></Field>
        </section>

        <section>
          <h3 className="text-title-sm font-semibold mb-2">Specifications</h3>
          {specs.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <Input placeholder="e.g. Material" value={s.k} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
              <Input placeholder="e.g. Leather" value={s.v} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
              <button onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="Remove" className="text-on-surface-variant"><Icon name="delete" /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="add" onClick={() => setSpecs([...specs, { k: '', v: '' }])}>Add specification</Button>
        </section>
      </div>
    </Modal>
  );
}
