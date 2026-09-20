
import { useState, useEffect } from 'react';
import { getProductById, getSellerPublic, createConversation, createOrder, addToCart } from '../../../services/storage';
import NegotiationPanel from './NegotiationPanel';

export default function ProductDetail({ productId, sellerId, onClose, onChatOpened, onToast, onCartUpdate, onOrderPlaced }) {
  const [product, setProduct] = useState(null);
  const [seller, setSeller] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {

        const [p, s] = await Promise.all([
          getProductById(productId),
          sellerId ? getSellerPublic(sellerId) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setProduct(p);
          setSeller(s);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load product');
      }
    })();
    return () => { cancelled = true; };
  }, [productId, sellerId]);

  const handleChat = async () => {
    try {
      const convo = await createConversation(product.sellerId);
      onChatOpened(convo.id);
      onToast?.('Conversation started with the seller');
    } catch (err) {
      onToast?.(err.message || 'Could not start conversation', 'error');
    }
  };

  const handleBuy = async () => {
    if (!product) return;
    setBuying(true);
    setError('');
    try {
      await createOrder([{ product_id: product.id, quantity }], {
        shippingAddress: 'To be confirmed',
      });
      onToast?.(`Order placed for ${quantity} × ${product.name}`);
    } catch (err) {
      setError(err.message || 'Order failed');
    } finally {
      setBuying(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    setError('');
    try {
      const cart = await addToCart(product.id, quantity);
      onCartUpdate?.(cart);
      onToast?.(`Added ${quantity} × ${product.name} to cart`);
    } catch (err) {
      setError(err.message || 'Could not add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  if (!product && !error) {
    return (
      <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-surface-container-lowest rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <span className="material-symbols-outlined animate-spin text-[32px] text-on-surface-variant">sync</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-48 bg-surface-container flex items-center justify-center">
          {product?.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">inventory_2</span>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest flex items-center justify-center shadow">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{error}</div>}

          {product && (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-title-md text-primary font-bold">${product.price?.toLocaleString()}</p>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-label-sm text-on-surface-variant">
                    {product.category || 'general'}
                  </span>
                </div>
                <h2 className="text-headline-md text-on-surface font-semibold mt-1">{product.name}</h2>
                <p className="text-body-md text-on-surface-variant mt-2">{product.description || 'No description provided.'}</p>
                <p className="text-label-sm text-on-surface-variant mt-2">
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </p>
              </div>

              <div className="border-t border-outline-variant pt-3">
                <p className="text-label-sm text-on-surface-variant">Seller</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="material-symbols-outlined text-on-surface-variant">storefront</span>
                  <span className="text-label-md text-on-surface font-semibold">{seller?.business_name || `Seller #${product.sellerId}`}</span>
                  {seller?.trust_score != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-label-sm font-semibold">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      Trust {Math.round(seller.trust_score)}
                    </span>
                  )}
                  {seller?.verification_status === 'verified' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-label-sm font-medium">Verified</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-label-md text-on-surface">Qty</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-9 h-9 rounded-lg border border-outline-variant flex items-center justify-center">−</button>
                  <span className="w-10 text-center text-label-md text-on-surface">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock || 1, quantity + 1))} className="w-9 h-9 rounded-lg border border-outline-variant flex items-center justify-center">+</button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleChat}
                  className="flex-1 h-12 rounded-lg border-2 border-primary text-primary text-label-md flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  Chat
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !product.stock}
                  className="flex-1 h-12 rounded-lg border-2 border-primary text-primary text-label-md flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  {addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>
              </div>
              <button
                onClick={handleBuy}
                disabled={buying || !product.stock}
                className="w-full h-12 rounded-lg bg-primary text-on-primary text-label-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                {buying ? 'Placing...' : `Buy Now · $${(product.price * quantity).toLocaleString()}`}
              </button>

              <NegotiationPanel
                product={product}
                quantity={quantity}
                onToast={onToast}
                onOrderPlaced={(order) => { onOrderPlaced?.(order); onClose(); }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}