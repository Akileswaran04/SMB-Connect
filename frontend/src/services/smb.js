/**
 * API client for the SMBConnect features (catalogue, cart/checkout, orders,
 * shipments, logistics, notifications, personalisation, assistant, admin).
 * Responses are returned as the backend sends them (snake_case).
 */
import api from '../utils/api';

const qs = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

// ── Auth ──
export const requestOtp = (identifier) => api.post('/auth/otp/request', { identifier });
export const verifyOtp = (identifier, code) => api.post('/auth/otp/verify', { identifier, code });
export const getMe = () => api.get('/auth/me');
export const setLanguage = (preferred_language) => api.patch('/auth/me/language', { preferred_language });

// ── Catalogue ──
export const getCategories = () => api.get('/categories');
export const searchCatalogue = (params) => api.get(`/discover${qs(params)}`);
export const naturalSearch = (q, sort) => api.get(`/discover/natural${qs({ q, sort })}`);
export const getProductDetails = (id) => api.get(`/products/${id}/details`);
export const getReviews = (id) => api.get(`/products/${id}/reviews`);
export const reportProduct = (id, reason) => api.post(`/products/${id}/report`, { reason });
export const getRecommendations = (params) => api.get(`/recommendation${qs(params)}`);
export const compareProducts = (product_ids) => api.post('/recommendation/compare', { product_ids });

// ── Cart & checkout ──
export const getCart = (delivery_option = 'standard') => api.get(`/cart${qs({ delivery_option })}`);
export const addToCart = (body) => api.post('/cart/items', body);
export const updateCartItem = (id, quantity) => api.patch(`/cart/items/${id}`, { quantity });
export const removeCartItem = (id) => api.delete(`/cart/items/${id}`);
export const checkout = (body) => api.post('/cart/checkout', body);
export const getAddresses = () => api.get('/buyers/me/addresses');
export const createAddress = (body) => api.post('/buyers/me/addresses', body);
export const deleteAddress = (id) => api.delete(`/buyers/me/addresses/${id}`);

// ── Orders ──
export const listOrders = (group) => api.get(`/orders${qs({ group: group === 'all' ? undefined : group })}`);
export const getOrder = (id) => api.get(`/orders/${id}`);
export const getTracking = (id) => api.get(`/orders/${id}/tracking`);
export const setOrderStatus = (id, status, extra = {}) => api.patch(`/orders/${id}/status`, { status, ...extra });
export const cancelOrder = (id, reason) => api.post(`/orders/${id}/cancel`, { reason });
export const requestReturn = (id, reason) => api.post(`/orders/${id}/return`, { reason });
export const reorder = (id) => api.post(`/orders/${id}/reorder`, { add_to_cart: true });
export const reviewOrder = (id, body) => api.post(`/orders/${id}/review`, body);
export const getInvoice = (id) => api.get(`/orders/${id}/invoice`);
export const getPayment = (orderId) => api.get(`/payments/orders/${orderId}`);

// ── Shipments & logistics ──
export const createShipment = (body) => api.post('/shipments', body);
export const listShipments = (params) => api.get(`/shipments${qs(params)}`);
export const getShipment = (id) => api.get(`/shipments/${id}`);
export const shipmentForOrder = (orderId) => api.get(`/shipments/by-order/${orderId}`);
export const shippingLabel = (id) => api.get(`/shipments/${id}/label`);
export const assignPartner = (id, logistics_partner_id) => api.patch(`/shipments/${id}/assign`, { logistics_partner_id });
export const acceptPickup = (id) => api.post(`/shipments/${id}/accept`);
export const advanceShipment = (id, status, extra = {}) => api.post(`/shipments/${id}/status`, { status, ...extra });
export const updateShipmentLocation = (id, location) => api.post(`/shipments/${id}/location`, { location });
export const deliverShipment = (id, body) => api.post(`/shipments/${id}/deliver`, body);
export const listPartners = () => api.get('/logistics/partners');
export const logisticsDashboard = () => api.get('/logistics/dashboard');
export const getLogisticsProfile = () => api.get('/logistics/me');
export const updateLogisticsProfile = (body) => api.put('/logistics/me', body);

// ── Negotiation ──
export const negotiationSuggestion = (productId, quantity = 1, desired_price) =>
  api.get(`/negotiation/products/${productId}/suggestion${qs({ quantity, desired_price })}`);
export const sendOffer = (product_id, offered_price, quantity = 1, message) =>
  api.post('/negotiation/offers', { product_id, offered_price, quantity, message: message || null });
export const respondOffer = (id, action, counter_price, message) =>
  api.post(`/negotiation/offers/${id}/respond`, { action, counter_price: counter_price ?? null, message: message || null });
export const offerThread = (productId) => api.get(`/negotiation/products/${productId}/thread`);
export const listOffers = (status) => api.get(`/negotiation/offers${qs({ status })}`);
export const getRule = (productId) => api.get(`/negotiation/products/${productId}/rule`);
export const saveRule = (productId, body) => api.put(`/negotiation/products/${productId}/rule`, body);

// ── Notifications ──
export const listNotifications = (unread_only) => api.get(`/notifications${qs({ unread_only })}`);
export const unreadNotifications = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/read-all');

// ── Buyer personalisation ──
export const getHome = () => api.get('/buyers/me/home');
export const getPreferences = () => api.get('/buyers/me/preferences');
export const savePreferences = (changes) => api.put('/buyers/me/preferences', changes);
export const getPersonalisation = () => api.get('/buyers/me/personalisation');
export const getBuyerProfile = () => api.get('/buyers/me');
export const updateBuyerProfile = (body) => api.put('/buyers/me', body);

// ── Assistant ──
export const assistantUnderstand = (text, priority) => api.post('/assistant/understand', { text, priority });
export const assistantChat = (message, context, extra = {}) => api.post('/assistant/chat', { message, context, ...extra });
export const assistantVoice = (text, source_language, context) => api.post('/assistant/voice', { text, source_language, context });

// ── Chat ──
export const openConversationWithSeller = (seller_id) => api.post('/conversations', { seller_id });
export const openConversationWithBuyer = (buyer_id) => api.post('/conversations', { buyer_id });
export const sendChatMessage = (conversationId, content, message_type = 'text') =>
  api.post(`/conversations/${conversationId}/messages`, {
    content, message_type, client_message_id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

// ── Disputes ──
export const raiseDispute = (body) => api.post('/disputes', body);
export const listDisputes = (status) => api.get(`/disputes${qs({ status })}`);
export const resolveDispute = (id, body) => api.patch(`/disputes/${id}`, body);

// ── Seller hub ──
export const sellerDashboard = () => api.get('/sellers/dashboard');
export const sellerPayments = () => api.get('/sellers/payments');
export const sellerInsights = (days = 30) => api.get(`/sellers/insights${qs({ days })}`);
export const sellerCustomers = () => api.get('/sellers/customers');
export const sellerProfile = () => api.get('/sellers/profile');
export const updateSellerProfile = (body) => api.put('/sellers/profile', body);
export const submitSellerProfile = () => api.post('/sellers/profile/submit');
export const listMyProducts = () => api.get('/products?limit=100');
export const getMyProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (body) => api.post('/products', body);
export const updateProduct = (id, body) => api.put(`/products/${id}`, body);
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const addVariant = (id, body) => api.post(`/products/${id}/variants`, body);
export const updateVariant = (id, vid, body) => api.put(`/products/${id}/variants/${vid}`, body);
export const deleteVariant = (id, vid) => api.delete(`/products/${id}/variants/${vid}`);
export const getInventory = (state) => api.get(`/inventory${qs({ state })}`);
export const adjustInventory = (body) => api.post('/inventory/adjust', body);
export const setIncoming = (body) => api.post('/inventory/incoming', body);
export const receiveIncoming = (body) => api.post('/inventory/receive', body);
export const inventoryLog = (product_id) => api.get(`/inventory/transactions${qs({ product_id })}`);
export const trustScore = (sellerId) => api.get(`/analytics/${sellerId}/trust-score`);

// ── Admin ──
export const admin = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params) => api.get(`/admin/users${qs(params)}`),
  updateUser: (id, body) => api.patch(`/admin/users/${id}`, body),
  sellers: (status) => api.get(`/admin/sellers${qs({ status })}`),
  seller: (id) => api.get(`/admin/sellers/${id}`),
  decideSeller: (id, decision, note) => api.patch(`/admin/sellers/${id}/verification`, { decision, note }),
  products: (params) => api.get(`/admin/products${qs(params)}`),
  moderateProduct: (id, status, note) => api.patch(`/admin/products/${id}`, { status, note }),
  reports: (status = 'open') => api.get(`/admin/reports${qs({ status })}`),
  resolveReport: (id, body) => api.patch(`/admin/reports/${id}`, body),
  categories: () => api.get('/admin/categories'),
  createCategory: (body) => api.post('/admin/categories', body),
  updateCategory: (id, body) => api.patch(`/admin/categories/${id}`, body),
  deleteCategory: (id) => api.delete(`/admin/categories/${id}`),
  inspectOrder: (id) => api.get(`/admin/orders/${id}`),
  analytics: (days = 30) => api.get(`/admin/analytics${qs({ days })}`),
  settings: () => api.get('/admin/settings'),
  saveSettings: (body) => api.put('/admin/settings', body),
  runSettlements: () => api.post('/admin/settlements/run'),
  auditLogs: () => api.get('/admin/audit-logs?limit=100'),
};
