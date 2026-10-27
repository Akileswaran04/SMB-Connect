/**
 * Product page (PRD §11). Decision information first — price, options,
 * availability, delivery date, returns, seller trust — then specifications,
 * description and reviews behind progressive disclosure.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { getProductDetails, addToCart, openConversationWithSeller, reportProduct } from '../../../services/smb';
import NegotiationPanel from './NegotiationPanel';
import { Icon, Badge, Button, Loading, ErrorNote, Modal, Textarea, QuickReasons } from '../../../components/ui';
import { inr, dayDate, dateShort, REASONS } from '../../../utils/format';
import { t } from '../../../i18n';

export default function ProductPage({ productId, prefs, onClose, onToast, onCartChanged, onBuyNow, onChatOpened, onAskAssistant }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState('');
  const [image, setImage] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [needSize, setNeedSize] = useState(false);
  const optionsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getProductDetails(productId).then((d) => {
      if (cancelled) return;
      setP(d);
      const sizes = [...new Set(d.variants.map((v) => v.size).filter(Boolean))];
      const remembered = prefs?.sizes && Object.entries(prefs.sizes).find(([cat]) => cat.toLowerCase() === d.category.toLowerCase())?.[1];
      if (remembered && sizes.includes(remembered)) setSize(remembered);
      else if (sizes.length === 1) setSize(sizes[0]);
      const colors = [...new Set(d.variants.map((v) => v.color).filter(Boolean))];
      if (colors.length === 1) setColor(colors[0]);
    }).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [productId, prefs]);

  const sizes = useMemo(() => [...new Set((p?.variants || []).map((v) => v.size).filter(Boolean))], [p]);
  const colors = useMemo(() => [...new Set((p?.variants || []).map((v) => v.color).filter(Boolean))], [p]);
  const variant = useMemo(() => (p?.variants || []).find((v) => (!sizes.length || v.size === size) && (!colors.length || v.color === color)), [p, size, color, sizes, colors]);
  const hasVariants = (p?.variants || []).length > 0;
  const stock = hasVariants ? (variant?.stock ?? 0) : p?.stock ?? 0;
  const price = hasVariants && variant ? variant.effective_price : p?.price_info?.unit;
  const rememberedSize = prefs?.sizes && p && Object.entries(prefs.sizes).find(([cat]) => cat.toLowerCase() === p.category.toLowerCase())?.[1];
  const images = [p?.image_url, ...(p?.images || [])].filter(Boolean);

  const needChoice = () => {
    if (hasVariants && !variant) {
      // Show where to choose instead of only saying so.
      setNeedSize(true);
      optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    return false;
  };

  const add = async (thenCheckout) => {
    if (needChoice()) return;
    setBusy(thenCheckout ? 'buy' : 'cart');
    try {
      await addToCart({ product_id: p.id, variant_id: variant?.id ?? null, quantity: qty });
      onCartChanged?.();
      if (thenCheckout) onBuyNow?.();
      else onToast?.(t('Added to cart'));
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const chat = async () => {
    setBusy('chat');
    try {
      const convo = await openConversationWithSeller(p.seller.id);
      onChatOpened?.(convo.id);
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const submitReport = async () => {
    try {
      await reportProduct(p.id, reason);
      setReporting(false);
      setReason('');
      onToast?.(t('Thank you — our team will check this product.'));
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest w-full sm:max-w-4xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex justify-end p-2 bg-gradient-to-b from-surface-container-lowest to-transparent">
          <button onClick={onClose} aria-label={t('Close')} className="w-11 h-11 rounded-full bg-surface-container-lowest shadow flex items-center justify-center"><Icon name="close" /></button>
        </div>
        <ErrorNote>{error}</ErrorNote>
        {!p && !error && <Loading />}
        {p && (
          <div className="grid md:grid-cols-2 gap-6 px-5 pb-6 -mt-8">
            <div>
              <div className="aspect-square bg-surface-container rounded-xl overflow-hidden flex items-center justify-center">
                {images.length ? <img src={images[image]} alt={p.name} className="w-full h-full object-cover" /> : <Icon name="inventory_2" size={64} className="text-on-surface-variant/40" />}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 mt-2">
                  {images.map((src, i) => (
                    <button key={src} onClick={() => setImage(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${i === image ? 'border-primary' : 'border-transparent'}`}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-label-sm text-on-surface-variant">{p.category}</p>
                <h2 className="text-headline-sm text-on-surface font-semibold">{p.name}</h2>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-headline-md font-bold text-on-surface">{inr(price ?? p.price)}</span>
                  {p.price_info?.discount_pct > 0 && !variant?.price && (
                    <>
                      <span className="text-body-md line-through text-on-surface-variant">{inr(p.price_info.listed)}</span>
                      <Badge tone="green">{t('{n}% off', { n: p.price_info.discount_pct })}</Badge>
                    </>
                  )}
                </div>
                {p.rating?.count > 0 && <p className="text-label-md text-on-surface-variant">{p.rating.average}★ · {t('{n} reviews', { n: p.rating.count })}</p>}
                {p.bulk_pricing?.length > 0 && (
                  <p className="text-label-sm text-emerald-700 mt-1">{p.bulk_pricing.map((b) => t('Buy {n} or more at {price} each', { n: b.min_qty, price: inr(b.unit_price) })).join(' · ')}</p>
                )}
              </div>

              <div ref={optionsRef} className={`space-y-4 rounded-xl ${needSize && hasVariants && !variant ? 'ring-2 ring-error p-3' : ''}`}>
              {needSize && hasVariants && !variant && <p className="text-label-md text-error font-semibold">{t('Please choose a size / colour first')}</p>}
              {sizes.length > 0 && (
                <div>
                  <p className="text-label-md font-medium text-on-surface">{t('Size')} {rememberedSize && sizes.includes(rememberedSize) && <span className="text-on-surface-variant font-normal">— {t('you usually buy {size}', { size: rememberedSize })}</span>}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {sizes.map((s) => {
                      const inStock = p.variants.some((v) => v.size === s && (!color || v.color === color) && v.stock > 0);
                      return (
                        <button key={s} onClick={() => setSize(s)} disabled={!inStock} aria-pressed={size === s}
                          className={`min-w-12 h-12 px-3 rounded-lg border text-label-md ${size === s ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface'} disabled:opacity-35 disabled:line-through`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {colors.length > 1 && (
                <div>
                  <p className="text-label-md font-medium text-on-surface">{t('Colour')}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {colors.map((c) => (
                      <button key={c} onClick={() => setColor(c)} aria-pressed={color === c}
                        className={`h-12 px-3 rounded-lg border text-label-md ${color === c ? 'border-primary bg-primary-container/15 text-primary' : 'border-outline-variant text-on-surface'}`}>{c}</button>
                    ))}
                  </div>
                </div>
              )}
              </div>

              <ul className="space-y-1.5 text-label-md">
                <li className={`flex items-center gap-2 ${stock > 0 ? 'text-emerald-700' : 'text-error'}`}>
                  <Icon name={stock > 0 ? 'check_circle' : 'cancel'} size={18} />
                  {hasVariants && !variant ? t('Choose a size / colour to see if it is in stock') : stock > 0 ? (stock <= 5 ? t('In stock — only {n} left', { n: stock }) : t('In stock')) : t('Out of stock')}
                </li>
                <li className="flex items-center gap-2 text-on-surface">
                  <Icon name="local_shipping" size={18} className="text-on-surface-variant" />
                  {t('Delivery by')} <strong>{dayDate(p.delivery.standard_date)}</strong>{p.delivery.express_available && ` · ${t('next-day delivery possible')}`}
                </li>
                <li className="flex items-center gap-2 text-on-surface">
                  <Icon name="assignment_return" size={18} className="text-on-surface-variant" />{p.return_summary}
                </li>
              </ul>

              <div className="flex items-center gap-3">
                <span className="text-label-md text-on-surface">{t('How many')}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 rounded-lg border border-outline-variant text-title-lg" aria-label={t('One less')}>−</button>
                  <span className="w-12 text-center text-title-md font-semibold">{qty}</span>
                  <button onClick={() => setQty(Math.min(Math.max(stock, 1), qty + 1))} className="w-12 h-12 rounded-lg border border-outline-variant text-title-lg" aria-label={t('One more')}>+</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" icon="add_shopping_cart" disabled={!!busy || (hasVariants && variant && stock === 0) || (!hasVariants && stock === 0)} onClick={() => add(false)}>
                  {busy === 'cart' ? t('Please wait…') : t('Add to cart')}
                </Button>
                <Button size="lg" icon="bolt" disabled={!!busy || (hasVariants && variant && stock === 0) || (!hasVariants && stock === 0)} onClick={() => add(true)}>
                  {busy === 'buy' ? t('Please wait…') : t('Buy now')}
                </Button>
              </div>
              {p.negotiation_enabled && (
                <NegotiationPanel product={p} variantId={variant?.id} needsVariant={hasVariants} quantity={qty} onToast={onToast} onAddedToCart={onCartChanged} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" icon="chat" onClick={chat} disabled={busy === 'chat'}>{t('Chat with seller')}</Button>
                <Button variant="secondary" icon="assistant" onClick={() => onAskAssistant({ current_product_id: p.id, product_ids: [p.id] })}>{t('Ask a question')}</Button>
              </div>

              <div className="border border-outline-variant rounded-xl p-3 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center"><Icon name="storefront" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-label-md font-semibold text-on-surface truncate">{p.seller.business_name}</p>
                  <p className="text-label-sm text-on-surface-variant">{p.seller.city} · {t('selling here since {date}', { date: dateShort(p.seller.member_since) })}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {p.seller.verification_status === 'verified' && <Badge tone="blue"><Icon name="verified" size={14} />{t('Verified')}</Badge>}
                  {p.seller.trust_score >= 70 && <Badge tone="green"><Icon name="thumb_up" size={14} />{t('Trusted seller')}</Badge>}
                </div>
              </div>

              <details className="border-t border-outline-variant pt-3">
                <summary className="text-label-md text-primary font-semibold cursor-pointer min-h-10 flex items-center">{t('More details')}</summary>
                <div className="mt-3 space-y-3">
                  <p className="text-body-md text-on-surface-variant whitespace-pre-line">{p.description || t('No description yet.')}</p>
                  {Object.keys(p.specifications || {}).length > 0 && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-label-md">
                      {Object.entries(p.specifications).map(([k, v]) => (
                        <div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="text-on-surface">{v}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              </details>

              <details className="border-t border-outline-variant pt-3" open={p.reviews.length > 0 && p.reviews.length <= 2}>
                <summary className="text-label-md text-primary font-semibold cursor-pointer min-h-10 flex items-center">{t('Reviews')} ({p.rating.count})</summary>
                <div className="mt-2 space-y-3">
                  {p.reviews.length === 0 && <p className="text-label-md text-on-surface-variant">{t('No reviews yet.')}</p>}
                  {p.reviews.map((r) => (
                    <div key={r.id} className="text-label-md">
                      <p className="text-on-surface"><span className="text-amber-600">{'★'.repeat(r.rating)}</span> {r.title && <strong>{r.title}</strong>}</p>
                      {r.comment && <p className="text-on-surface-variant">{r.comment}</p>}
                      <p className="text-label-sm text-on-surface-variant">{r.customer_name}{r.is_verified_purchase ? ` · ${t('Bought here')}` : ''} · {dateShort(r.created_at)}</p>
                      {r.seller_reply && <p className="text-label-sm text-on-surface mt-1 pl-3 border-l-2 border-outline-variant">{t('Seller')}: {r.seller_reply}</p>}
                    </div>
                  ))}
                </div>
              </details>
              <button onClick={() => setReporting(true)} className="min-h-10 text-label-sm text-on-surface-variant hover:text-error inline-flex items-center gap-1">
                <Icon name="flag" size={16} /> {t('Report a problem with this product')}
              </button>
            </div>
          </div>
        )}
      </div>
      <Modal open={reporting} onClose={() => setReporting(false)} title={t('Report a problem')}
        footer={<><Button variant="secondary" onClick={() => setReporting(false)}>{t('Cancel')}</Button><Button variant="danger" disabled={reason.trim().length < 3} onClick={submitReport}>{t('Send')}</Button></>}>
        <QuickReasons options={REASONS.report} value={reason} onPick={setReason} />
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Or tell us what is wrong')} />
      </Modal>
    </div>
  );
}
