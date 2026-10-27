/**
 * Add / edit a product (PRD §32, §34), built for a shop owner on a phone:
 * "Quick add" first — photos from the camera or gallery (shrunk on the
 * phone, so any photo works), name and description by voice, price, stock —
 * and everything else (offer/festival prices, bulk prices, sizes & colours,
 * delivery, returns, specifications) under "More options".
 * A stray tap outside never closes the form; Cancel asks before throwing work away.
 * Stock changes on an existing product go through Stock so every change is logged.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { createProduct, updateProduct, addVariant, updateVariant, deleteVariant, getCategories } from '../../services/smb';
import { Modal, Button, Field, Input, Select, Toggle, Icon, ErrorNote } from '../../components/ui';
import VoiceField from '../../components/VoiceField';
import { compressImage } from '../../utils/image';
import { inr } from '../../utils/format';
import { t } from '../../i18n';

const blankVariant = { size: '', color: '', sku: '', price: '', stock: '' };
const MAX_PHOTOS = 6;

function Section({ title, open, children }) {
  return (
    <details open={open} className="border border-outline-variant rounded-xl px-4 py-2">
      <summary className="text-title-sm font-semibold text-on-surface cursor-pointer py-2">{title}</summary>
      <div className="pb-3 pt-1 space-y-3">{children}</div>
    </details>
  );
}

function VariantRow({ v, onChange, onRemove, stockEditable }) {
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end border border-outline-variant rounded-lg p-3">
      <Field label={t('Size')}><Input value={v.size || ''} onChange={set('size')} placeholder="e.g. 9" /></Field>
      <Field label={t('Colour')}><Input value={v.color || ''} onChange={set('color')} placeholder="e.g. Black" /></Field>
      <Field label={t('Price (₹, optional)')}><Input type="number" inputMode="decimal" value={v.price} onChange={set('price')} /></Field>
      <Field label={t('Stock')}>
        {stockEditable
          ? <Input type="number" inputMode="numeric" min="0" value={v.stock} onChange={set('stock')} />
          : <p className="h-11 flex items-center text-body-md" title={t('Change from the Stock page')}>{v.stock}{v.reserved_stock ? ` (+${v.reserved_stock} ${t('on hold')})` : ''}</p>}
      </Field>
      <div className="flex gap-2 col-span-2 sm:col-span-1">
        <Field label={t('Item code')} className="flex-1"><Input value={v.sku || ''} onChange={set('sku')} /></Field>
        <button type="button" onClick={onRemove} aria-label={t('Remove')} className="h-11 w-11 self-end flex items-center justify-center text-on-surface-variant hover:text-error"><Icon name="delete" /></button>
      </div>
    </div>
  );
}

export default function ProductEditor({ product, onClose, onSaved, onToast }) {
  const editing = !!product;
  const [f, setF] = useState(() => ({
    name: product?.name || '', category: product?.category || '', description: product?.description || '',
    price: product?.price ?? '', sale_price: product?.sale_price ?? '', promo_price: product?.promo_price ?? '',
    promo_ends_at: product?.promo_ends_at ? product.promo_ends_at.slice(0, 16) : '',
    sku: product?.sku || '', stock: product?.stock ?? '', low_stock_threshold: product?.low_stock_threshold ?? 5,
    delivery_days: product?.delivery_days ?? 4, express_available: !!product?.express_available,
    return_days: product?.return_days ?? 7, return_policy: product?.return_policy || '',
  }));
  const [photos, setPhotos] = useState(() => [product?.image_url, ...(product?.images || [])].filter(Boolean));
  const [tiers, setTiers] = useState(product?.bulk_pricing || []);
  const [specs, setSpecs] = useState(Object.entries(product?.specifications || {}).map(([k, v]) => ({ k, v })));
  const [variants, setVariants] = useState((product?.variants || []).map((v) => ({ ...v, price: v.price ?? '' })));
  const [newVariants, setNewVariants] = useState([]);
  const [quickSizes, setQuickSizes] = useState('');
  const [removed, setRemoved] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = useRef(false);

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);
  const touch = () => { dirty.current = true; };
  const set = (k) => (e) => { touch(); setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })); };
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

  const categoryNames = useMemo(() => {
    const names = categories.map((c) => c.name);
    return f.category && !names.includes(f.category) ? [f.category, ...names] : names;
  }, [categories, f.category]);

  const close = () => {
    if (dirty.current && !window.confirm(t('Close without saving? Your changes will be lost.'))) return;
    onClose();
  };

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])].filter((file) => file.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setPhotoBusy(true);
    try {
      const shrunk = await Promise.all(files.map((file) => compressImage(file)));
      touch();
      setPhotos((p) => [...p, ...shrunk].slice(0, MAX_PHOTOS));
    } catch {
      setError(t('Could not read that photo. Please try another one.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const addQuickSizes = () => {
    const sizes = quickSizes.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!sizes.length) return;
    touch();
    setNewVariants((v) => [...v, ...sizes.map((size) => ({ ...blankVariant, size }))]);
    setQuickSizes('');
  };

  const listed = Number(f.price) || 0;
  const selling = Number(f.sale_price) || listed;
  const off = listed && selling < listed ? Math.round((1 - selling / listed) * 100) : 0;

  const save = async () => {
    setError('');
    if (!f.name.trim()) return setError(t('Please enter the product name'));
    if (!f.category.trim()) return setError(t('Please choose a category'));
    if (!Number(f.price)) return setError(t('Please enter the price'));
    if (f.sale_price && Number(f.sale_price) >= Number(f.price)) return setError(t('Offer price must be lower than the MRP'));
    const payload = {
      name: f.name.trim(), category: f.category.trim(), description: f.description || null,
      image_url: photos[0] || null, images: photos.slice(1),
      price: Number(f.price), sale_price: num(f.sale_price), promo_price: num(f.promo_price),
      promo_ends_at: f.promo_ends_at ? new Date(f.promo_ends_at).toISOString() : null,
      bulk_pricing: tiers.filter((x) => x.min_qty && x.unit_price).map((x) => ({ min_qty: Number(x.min_qty), unit_price: Number(x.unit_price) })),
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
      dirty.current = false;
      onToast?.(editing ? t('Product updated') : t('Product added — buyers can see it now'));
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasVariants = variants.length + newVariants.length > 0;

  return (
    <Modal open persistent onClose={close} title={editing ? t('Edit product') : t('Add a product')} wide
      footer={<><Button variant="secondary" onClick={close}>{t('Cancel')}</Button><Button size="lg" icon="check" onClick={save} disabled={saving || photoBusy}>{saving ? t('Saving…') : t('Save product')}</Button></>}>
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>

        <div>
          <p className="text-label-md font-medium text-on-surface mb-1.5">{t('Photos')} <span className="text-on-surface-variant font-normal">— {t('the first photo is shown to buyers first')}</span></p>
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={`${i}-${src.slice(-20)}`} className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-primary' : 'border-outline-variant'}`}>
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { touch(); setPhotos((p) => p.filter((_, j) => j !== i)); }} aria-label={t('Remove photo')}
                  className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"><Icon name="close" size={18} /></button>
                {i > 0 && (
                  <button type="button" onClick={() => { touch(); setPhotos((p) => [p[i], ...p.filter((_, j) => j !== i)]); }}
                    className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-label-sm py-1">{t('Make first')}</button>
                )}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-primary/60 text-primary flex flex-col items-center justify-center gap-1 cursor-pointer text-label-sm text-center">
                <Icon name={photoBusy ? 'progress_activity' : 'add_a_photo'} size={28} className={photoBusy ? 'animate-spin' : ''} />
                {photoBusy ? t('Please wait…') : t('Add photo')}
                <input type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} disabled={photoBusy} />
              </label>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t('Product name')} className="sm:col-span-2">
            <VoiceField as="input" value={f.name} onChange={set('name')} placeholder="e.g. Black formal leather shoe" />
          </Field>
          <Field label={t('Category')}>
            {categoryNames.length ? (
              <Select value={f.category} onChange={set('category')}>
                <option value="">{t('Choose one')}</option>
                {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            ) : <Input value={f.category} onChange={set('category')} placeholder="e.g. Footwear" />}
          </Field>
          {!hasVariants && (
            <Field label={t('How many do you have?')} hint={editing ? t('Change stock from the Stock page — every change is saved in the history.') : null}>
              <Input type="number" inputMode="numeric" min="0" value={f.stock} onChange={set('stock')} disabled={editing} placeholder="e.g. 20" />
            </Field>
          )}
          <Field label={t('MRP / price (₹)')}><Input type="number" inputMode="decimal" min="1" value={f.price} onChange={set('price')} placeholder="e.g. 1499" /></Field>
          <Field label={t('Offer price (₹, optional)')}><Input type="number" inputMode="decimal" min="1" value={f.sale_price} onChange={set('sale_price')} placeholder={t('Leave empty if no offer')} /></Field>
          {listed > 0 && (
            <p className="sm:col-span-2 text-body-md bg-surface-container-low rounded-lg px-3 py-2">
              {t('Buyers will see')} <strong>{inr(selling)}</strong>{off > 0 && <> <span className="line-through text-on-surface-variant">{inr(listed)}</span> <span className="text-emerald-700 font-semibold">{t('{n}% off', { n: off })}</span></>}
            </p>
          )}
          <Field label={t('Description')} className="sm:col-span-2">
            <VoiceField value={f.description} onChange={set('description')} placeholder={t('What should buyers know? Material, size, use… You can speak instead of typing.')} />
          </Field>
        </div>

        <p className="text-label-md text-on-surface-variant pt-1">{t('More options (only if you need them)')}</p>

        <Section title={t('Sizes and colours')} open={hasVariants}>
          <p className="text-label-md text-on-surface-variant">{t('Add these only if the product comes in different sizes or colours. Each one has its own stock.')}</p>
          <div className="flex gap-2">
            <Input value={quickSizes} onChange={(e) => setQuickSizes(e.target.value)} placeholder={t('Quick add sizes, e.g. 6, 7, 8, 9')} />
            <Button variant="secondary" onClick={addQuickSizes} disabled={!quickSizes.trim()}>{t('Add')}</Button>
          </div>
          {variants.map((v, i) => (
            <VariantRow key={v.id} v={v} onChange={(nv) => { touch(); setVariants(variants.map((x, j) => (j === i ? nv : x))); }}
              onRemove={() => { touch(); setRemoved([...removed, v.id]); setVariants(variants.filter((_, j) => j !== i)); }} />
          ))}
          {newVariants.map((v, i) => (
            <VariantRow key={`n${i}`} v={v} stockEditable onChange={(nv) => { touch(); setNewVariants(newVariants.map((x, j) => (j === i ? nv : x))); }}
              onRemove={() => setNewVariants(newVariants.filter((_, j) => j !== i))} />
          ))}
          <Button variant="ghost" size="sm" icon="add" onClick={() => { touch(); setNewVariants([...newVariants, { ...blankVariant }]); }}>{t('Add one size / colour')}</Button>
        </Section>

        <Section title={t('Special prices')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('Festival / limited-time price (₹)')}><Input type="number" inputMode="decimal" min="1" value={f.promo_price} onChange={set('promo_price')} /></Field>
            <Field label={t('Festival price ends on')}><Input type="datetime-local" value={f.promo_ends_at} onChange={set('promo_ends_at')} /></Field>
          </div>
          <p className="text-label-md font-medium">{t('Wholesale prices')} <span className="text-on-surface-variant font-normal">— {t('lower price when buying many')}</span></p>
          {tiers.map((tier, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input type="number" inputMode="numeric" placeholder={t('Buy at least (pieces)')} value={tier.min_qty} onChange={(e) => { touch(); setTiers(tiers.map((x, j) => (j === i ? { ...x, min_qty: e.target.value } : x))); }} />
              <Input type="number" inputMode="decimal" placeholder={t('Price for each (₹)')} value={tier.unit_price} onChange={(e) => { touch(); setTiers(tiers.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x))); }} />
              <button type="button" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label={t('Remove')} className="h-11 w-11 flex-shrink-0 flex items-center justify-center text-on-surface-variant"><Icon name="delete" /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="add" onClick={() => setTiers([...tiers, { min_qty: '', unit_price: '' }])}>{t('Add wholesale price')}</Button>
          <p className="text-label-sm text-on-surface-variant">{t('Bargaining limits are set on the Price offers page.')}</p>
        </Section>

        <Section title={t('Delivery and returns')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('Days to deliver')}><Input type="number" inputMode="numeric" min="1" value={f.delivery_days} onChange={set('delivery_days')} /></Field>
            <Field label={t('Days to return')} hint={t('0 = no returns')}><Input type="number" inputMode="numeric" min="0" value={f.return_days} onChange={set('return_days')} /></Field>
          </div>
          <Toggle label={t('Next-day delivery possible')} checked={f.express_available} onChange={(v) => { touch(); setF((x) => ({ ...x, express_available: v })); }} />
          <Field label={t('Return rules')}><Input value={f.return_policy} onChange={set('return_policy')} placeholder={t('e.g. Unused, with tag, within 7 days')} /></Field>
        </Section>

        <Section title={t('Item code and stock warning')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('Your item code (optional)')}><Input value={f.sku} onChange={set('sku')} /></Field>
            <Field label={t('Warn me when stock falls to')}><Input type="number" inputMode="numeric" min="0" value={f.low_stock_threshold} onChange={set('low_stock_threshold')} /></Field>
          </div>
        </Section>

        <Section title={t('Product details (material, weight…)')}>
          {specs.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input placeholder={t('e.g. Material')} value={s.k} onChange={(e) => { touch(); setSpecs(specs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x))); }} />
              <Input placeholder={t('e.g. Leather')} value={s.v} onChange={(e) => { touch(); setSpecs(specs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x))); }} />
              <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label={t('Remove')} className="h-11 w-11 flex-shrink-0 flex items-center justify-center text-on-surface-variant"><Icon name="delete" /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="add" onClick={() => setSpecs([...specs, { k: '', v: '' }])}>{t('Add a detail')}</Button>
        </Section>
      </div>
    </Modal>
  );
}
