
import api from '../utils/api';

export function getSession() {
  try {
    const raw = localStorage.getItem('technova_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(data) {
  const session = {
    token: data.access_token || data.token,
    role: data.role || data.role || 'seller',
    sellerId: data.seller_id || null,
    buyerId: data.buyer_id || null,
    logisticsId: data.logistics_id || null,
    email: data.email,
    fullName: data.full_name || data.fullName,
    language: data.preferred_language || 'en',
  };
  localStorage.setItem('technova_session', JSON.stringify(session));
  if (session.token) localStorage.setItem('technova_token', session.token);
  return session;
}

export function updateSessionLanguage(language) {
  const session = getSession();
  if (!session) return;
  localStorage.setItem('technova_session', JSON.stringify({ ...session, language }));
}

export function clearSession() {
  localStorage.removeItem('technova_session');
  localStorage.removeItem('technova_token');
}

export async function registerUser(data) {
  const result = await api.post('/auth/register', data);
  return setSession(result);
}

export async function loginUser(identifier, password) {
  const result = await api.post('/auth/login', { identifier, password });
  return setSession(result);
}

export const registerSeller = registerUser;
export const loginSeller = loginUser;

export async function demoLogin(demoKey) {
  const result = await api.post('/auth/demo-login', { demo: demoKey });
  return setSession(result);
}

export async function logoutUser() {
  try { await api.post('/auth/logout'); } catch {}
  clearSession();
}

export async function getCurrentUser() {
  return await api.get('/auth/me');
}

export async function getMyLanguage() {
  try {
    const data = await getCurrentUser();
    return data?.user?.preferred_language || 'en';
  } catch {
    return 'en';
  }
}

// The UI reads avatarImage / coverImage; the API uses snake_case.
const withSellerMedia = (s) => s && { ...s, avatarImage: s.avatar_image, coverImage: s.cover_image, documents: s.documents || [] };

export async function getSellerById() {
  const data = await getCurrentUser();
  return withSellerMedia(data?.seller) || null;
}

export async function updateSeller(id, updates) {
  const fieldMap = {
    storeName: 'business_name',
    category: 'business_type',
    description: 'description',
    phone: 'phone',
    email: 'email',
    address: 'address_line_1',
    avatarImage: 'avatar_image',
    coverImage: 'cover_image',
  };
  const payload = {};
  for (const [key, value] of Object.entries(updates)) {
    const backendKey = fieldMap[key] || key;
    if (value !== undefined) payload[backendKey] = value;
  }
  return withSellerMedia(await api.put('/sellers/profile', payload));
}

export async function getBuyerById() {
  const data = await getCurrentUser();
  return data?.buyer || null;
}

export async function updateBuyer(id, updates) {
  const payload = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) payload[key] = value;
  }
  return await api.put('/buyers/me', payload);
}

export async function getProductsBySeller(onPage) {

  const PAGE = 100;
  try {
    const all = [];
    let offset = 0;
    let hasMore = true;
    let pages = 0;
    while (hasMore && pages < 100) {
      const data = await api.get(`/products?limit=${PAGE}&offset=${offset}`);
      const items = (data?.items || []).map(mapProduct);
      all.push(...items);
      if (onPage) onPage(items);
      hasMore = !!data?.has_more;
      offset += PAGE;
      pages += 1;
    }
    return all;
  } catch {
    return [];
  }
}

function mapProduct(p) {
  return {
    id: p.id,
    sellerId: p.seller_id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    image: p.image_url,
    stock: p.stock,
    lowStockThreshold: p.low_stock_threshold,
    likes: p.likes,
    reviews: (p.reviews || []).map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      rating: r.rating,
      comment: r.comment,
      sellerReply: r.seller_reply,
      date: r.created_at,
    })),
    createdAt: p.created_at,
  };
}

export async function getProductById(id) {
  const p = await api.get(`/products/${id}`);
  return p ? mapProduct(p) : null;
}

export async function createProduct(data) {
  return await api.post('/products', {
    name: data.name,
    description: data.description,
    category: data.category || 'general',
    price: data.price,
    image_url: data.image,
    stock: data.stock || 0,
    low_stock_threshold: data.lowStockThreshold || 5,
  });
}

export async function updateProduct(id, updates) {
  const fieldMap = { image: 'image_url', lowStockThreshold: 'low_stock_threshold' };
  const payload = {};
  for (const [key, value] of Object.entries(updates)) {
    const backendKey = fieldMap[key] || key;
    if (value !== undefined) payload[backendKey] = value;
  }
  return await api.put(`/products/${id}`, payload);
}

export async function deleteProduct(id) {
  return await api.delete(`/products/${id}`);
}

export async function discover(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  }
  const query = qs.toString();
  return await api.get(`/discover${query ? `?${query}` : ''}`);
}

export async function getSellerPublic(sellerId) {
  return await api.get(`/sellers/${sellerId}`);
}

export async function getSellerPublicProducts(sellerId, cursor) {
  const qs = cursor ? `?cursor=${cursor}` : '';
  return await api.get(`/sellers/${sellerId}/products${qs}`);
}

export async function getCustomersBySeller() {
  try { return await api.get('/customers'); } catch { return []; }
}

export async function createCustomer(data) {
  return await api.post('/customers', {
    name: data.name, email: data.email || null, phone: data.contact || null,
  });
}

export async function updateCustomer(id, updates) {
  const payload = {};
  if (updates.contact !== undefined) payload.phone = updates.contact;
  if (updates.name !== undefined) payload.name = updates.name;
  return await api.put(`/customers/${id}`, payload);
}

export async function getConversations() {
  try {
    const data = await api.get('/conversations');
    return (data?.items || []).map((c) => ({
      id: c.id,
      sellerId: c.seller_id,
      buyerId: c.buyer_id,
      customerName: c.customer_name,
      lastMessage: c.last_message,
      lastMessageTime: c.last_message_at,
      unreadCount: c.unread_count,
      status: c.status,
    }));
  } catch {
    return [];
  }
}

export async function getConversationById(id) {

  const [c, page] = await Promise.all([
    api.get(`/conversations/${id}`),
    api.get(`/conversations/${id}/messages?limit=200`),
  ]);
  if (!c) return null;
  return {
    id: c.id,
    sellerId: c.seller_id,
    buyerId: c.buyer_id,
    customerName: c.customer_name,
    lastMessage: c.last_message,
    lastMessageTime: c.last_message_at,
    unreadCount: c.unread_count,
    status: c.status,
    messages: (page.items || []).map((m) => ({
      id: m.id,
      senderType: m.sender_type,
      text: m.content,
      messageType: m.message_type,
      sequenceNumber: m.sequence_number,
      timestamp: m.created_at,
      isAI: m.is_ai_generated,
      sentiment: m.sentiment,
      translatedText: m.translated_content,
      translatedLanguage: m.translated_language,
    })),
  };
}

export async function createConversation(buyerId) {
  return await api.post('/conversations', { buyer_id: buyerId });
}

export async function sendMessage(conversationId, message) {
  return await api.post(`/conversations/${conversationId}/messages`, {
    content: message.text,
    message_type: message.messageType || 'text',
    client_message_id: message.clientMessageId,
  });
}

export async function markAsRead(conversationId) {
  return await api.patch(`/conversations/${conversationId}/read`);
}

export async function listConversationDrafts(conversationId) {
  try {
    const data = await api.get(`/conversations/${conversationId}/drafts`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function generateDraft(conversationId) {
  return await api.post(`/conversations/${conversationId}/drafts`);
}

export async function editDraft(draftId, content) {
  return await api.put(`/ai/drafts/${draftId}`, { content });
}

export async function setDraftStatus(draftId, status) {
  return await api.patch(`/ai/drafts/${draftId}/status`, { status });
}

export async function sendDraft(draftId) {
  return await api.post(`/ai/drafts/${draftId}/send`);
}

export async function analyzeText(content) {
  return await api.post('/ai/analyze', { content });
}

export async function createOrder(items, extra = {}) {
  return await api.post('/orders', {
    items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    shipping_address: extra.shippingAddress,
    notes: extra.notes,
  });
}

export async function getOrders(cursor) {
  try {
    const qs = cursor ? `?cursor=${cursor}` : '';
    const data = await api.get(`/orders${qs}`);
    return { items: (data.items || []).map(mapOrder), nextCursor: data.next_cursor };
  } catch {
    return { items: [], nextCursor: null };
  }
}

export async function getOrder(id) {
  const o = await api.get(`/orders/${id}`);
  return o ? mapOrder(o) : null;
}

export async function updateOrderStatus(id, status, extra = {}) {
  return await api.patch(`/orders/${id}/status`, { status, location: extra.location, notes: extra.notes });
}

export async function getOrderTracking(id) {
  try {
    const events = await api.get(`/orders/${id}/tracking`);
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export async function reviewOrder(orderId, rating, comment, title) {
  return await api.post(`/orders/${orderId}/review`, { rating, comment, title });
}

function mapOrder(o) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    buyerId: o.buyer_id,
    sellerId: o.seller_id,
    status: o.status,
    totalAmount: o.total_amount,
    currency: o.currency,
    paymentMethod: o.payment_method,
    shippingAddress: o.shipping_address,
    notes: o.notes,
    createdAt: o.created_at,
    items: (o.items || []).map((i) => ({
      productId: i.product_id,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      totalPrice: i.total_price,
    })),
  };
}

function mapCart(c) {
  return {
    id: c.id,
    subtotal: c.subtotal,
    itemCount: c.item_count,
    items: (c.items || []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productImageUrl: i.product_image_url,
      unitPrice: i.unit_price,
      sellerId: i.seller_id,
      availableStock: i.available_stock,
      quantity: i.quantity,
      lineTotal: i.line_total,
    })),
  };
}

export async function getCart() {
  try {
    return mapCart(await api.get('/cart'));
  } catch {
    return { id: null, subtotal: 0, itemCount: 0, items: [] };
  }
}

export async function addToCart(productId, quantity = 1) {
  return mapCart(await api.post('/cart/items', { product_id: productId, quantity }));
}

export async function updateCartItem(itemId, quantity) {
  return mapCart(await api.patch(`/cart/items/${itemId}`, { quantity }));
}

export async function removeCartItem(itemId) {
  return mapCart(await api.delete(`/cart/items/${itemId}`));
}

export async function checkoutCart(addressId, extra = {}) {
  const orders = await api.post('/cart/checkout', {
    address_id: addressId,
    payment_method: extra.paymentMethod || 'mock',
    notes: extra.notes,
  });
  return (orders || []).map(mapOrder);
}

function mapAddress(a) {
  return {
    id: a.id,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    country: a.country,
    isDefault: a.is_default,
  };
}

export async function getAddresses() {
  try {
    const data = await api.get('/buyers/me/addresses');
    return (Array.isArray(data) ? data : []).map(mapAddress);
  } catch {
    return [];
  }
}

export async function createAddress(address) {
  return mapAddress(await api.post('/buyers/me/addresses', {
    label: address.label || 'Home',
    line1: address.line1,
    line2: address.line2 || null,
    city: address.city,
    state: address.state || null,
    postal_code: address.postalCode || null,
    country: address.country || 'India',
    is_default: !!address.isDefault,
  }));
}

export async function deleteAddress(id) {
  return await api.delete(`/buyers/me/addresses/${id}`);
}

export async function understandRequirement(text) {
  return await api.post('/assistant/understand', { text });
}

export async function understandVoice(text, sourceLanguage) {
  return await api.post('/assistant/voice', { text, source_language: sourceLanguage || 'en' });
}

export async function updatePreferredLanguage(language) {
  return await api.patch('/auth/me/language', { preferred_language: language });
}

export async function getRecommendations({ category, budget, q, location } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (budget) params.set('budget', budget);
  if (q) params.set('q', q);
  if (location) params.set('location', location);
  const qs = params.toString();
  try {
    const data = await api.get(`/recommendation${qs ? `?${qs}` : ''}`);
    return data?.items || [];
  } catch {
    return [];
  }
}

export async function compareProducts(productIds) {
  return await api.post('/recommendation/compare', { product_ids: productIds });
}

export async function getNegotiationSuggestion(productId, quantity = 1) {
  try {
    return await api.get(`/negotiation/products/${productId}/suggestion?quantity=${quantity}`);
  } catch {
    return null;
  }
}

export async function getNegotiationRule(productId) {
  try {
    return await api.get(`/negotiation/products/${productId}/rule`);
  } catch {
    return null;
  }
}

export async function setNegotiationRule(productId, rule) {
  return await api.put(`/negotiation/products/${productId}/rule`, {
    enabled: rule.enabled,
    min_price: rule.minPrice,
    auto_accept_threshold: rule.autoAcceptThreshold ?? null,
    counter_offer_range_pct: rule.counterOfferRangePct ?? 10,
    max_rounds: rule.maxRounds ?? 2,
  });
}

export async function createNegotiationOffer(productId, quantity, offeredPrice, message) {
  return await api.post('/negotiation/offers', {
    product_id: productId, quantity, offered_price: offeredPrice, message: message || null,
  });
}

export async function respondToOffer(offerId, action, extra = {}) {
  return await api.post(`/negotiation/offers/${offerId}/respond`, {
    action, counter_price: extra.counterPrice ?? null, message: extra.message || null,
  });
}

export async function getNegotiationThread(productId) {
  try {
    const data = await api.get(`/negotiation/products/${productId}/thread`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function listMyOffers(status) {
  try {
    const qs = status ? `?status=${status}` : '';
    const data = await api.get(`/negotiation/offers${qs}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function checkoutOffer(offerId, addressId, extra = {}) {
  return mapOrder(await api.post(`/negotiation/offers/${offerId}/checkout`, {
    address_id: addressId,
    payment_method: extra.paymentMethod || 'mock',
    notes: extra.notes,
  }));
}

export async function getPaymentForOrder(orderId) {
  return await api.get(`/payments/orders/${orderId}`);
}

export async function getSellerAnalytics(sellerId, force = false) {
  try {
    return await api.get(`/analytics/${sellerId}${force ? '?force=true' : ''}`);
  } catch {
    return null;
  }
}

export async function getTrustScore(sellerId) {
  try { return await api.get(`/analytics/${sellerId}/trust-score`); } catch { return null; }
}

export async function getTotalUnread() {

  try {
    const data = await api.get('/conversations/unread/total');
    return data?.total || 0;
  } catch {
    return 0;
  }
}

export function getRecentReviews(products, limit = 10) {
  const allReviews = [];
  for (const product of products) {
    for (const review of product.reviews || []) {
      allReviews.push({ ...review, productName: product.name, productId: product.id });
    }
  }
  return allReviews.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
}

export function computeTrustScore(products) {
  const allReviews = products.flatMap((p) => p.reviews || []);
  if (allReviews.length === 0) return null;
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  return Math.round(avg * 10) / 10;
}

export function getReviewCount(products) {
  return products.reduce((sum, p) => sum + (p.reviews?.length || 0), 0);
}

export function getDerivedCustomers(products) {
  const customerMap = {};
  for (const product of products) {
    for (const review of product.reviews || []) {
      const key = review.customerName.toLowerCase().trim();
      if (!customerMap[key]) {
        customerMap[key] = { name: review.customerName, reviews: [], lastDate: review.date };
      }
      customerMap[key].reviews.push({ ...review, productName: product.name, productId: product.id });
      if (review.date > customerMap[key].lastDate) customerMap[key].lastDate = review.date;
    }
  }
  return customerMap;
}