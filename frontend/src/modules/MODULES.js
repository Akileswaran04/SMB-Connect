/**
 * Seller navigation (PRD §29). `primary` tabs also appear in the mobile bottom bar.
 * Labels are everyday shop words ("Stock", not "Inventory"); screens pass them through t().
 */
export const TAB_KEYS = {
  DASHBOARD: 'dashboard',
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  ORDERS: 'orders',
  NEGOTIATION: 'negotiation',
  CUSTOMERS: 'customers',
  SHIPMENTS: 'shipments',
  PAYMENTS: 'payments',
  INBOX: 'inbox',
  ANALYTICS: 'analytics',
  PROFILE: 'profile',
};

const MODULES = [
  { key: TAB_KEYS.DASHBOARD, icon: 'dashboard', label: 'Home', primary: true },
  { key: TAB_KEYS.PRODUCTS, icon: 'inventory_2', label: 'Products', primary: true },
  { key: TAB_KEYS.INVENTORY, icon: 'shelves', label: 'Stock' },
  { key: TAB_KEYS.ORDERS, icon: 'receipt_long', label: 'Orders', primary: true },
  { key: TAB_KEYS.NEGOTIATION, icon: 'sell', label: 'Price offers' },
  { key: TAB_KEYS.CUSTOMERS, icon: 'group', label: 'Customers' },
  { key: TAB_KEYS.SHIPMENTS, icon: 'local_shipping', label: 'Deliveries' },
  { key: TAB_KEYS.PAYMENTS, icon: 'payments', label: 'Payments' },
  { key: TAB_KEYS.INBOX, icon: 'chat', label: 'Messages', primary: true },
  { key: TAB_KEYS.ANALYTICS, icon: 'analytics', label: 'Sales report' },
  { key: TAB_KEYS.PROFILE, icon: 'storefront', label: 'My shop' },
];

export function getNavTabs() {
  return MODULES;
}

export function getPrimaryTabs() {
  return MODULES.filter((m) => m.primary);
}

export default MODULES;
