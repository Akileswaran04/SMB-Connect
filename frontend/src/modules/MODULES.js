/** Seller navigation (PRD §29). `primary` tabs also appear in the mobile bottom bar. */
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
  { key: TAB_KEYS.DASHBOARD, icon: 'dashboard', label: 'Dashboard', primary: true },
  { key: TAB_KEYS.PRODUCTS, icon: 'inventory_2', label: 'Products', primary: true },
  { key: TAB_KEYS.INVENTORY, icon: 'shelves', label: 'Inventory' },
  { key: TAB_KEYS.ORDERS, icon: 'receipt_long', label: 'Orders', primary: true },
  { key: TAB_KEYS.NEGOTIATION, icon: 'sell', label: 'Negotiation' },
  { key: TAB_KEYS.CUSTOMERS, icon: 'group', label: 'Customers' },
  { key: TAB_KEYS.SHIPMENTS, icon: 'local_shipping', label: 'Shipments' },
  { key: TAB_KEYS.PAYMENTS, icon: 'payments', label: 'Payments' },
  { key: TAB_KEYS.INBOX, icon: 'chat', label: 'Messages', primary: true },
  { key: TAB_KEYS.ANALYTICS, icon: 'analytics', label: 'Analytics' },
  { key: TAB_KEYS.PROFILE, icon: 'storefront', label: 'Profile' },
];

export function getNavTabs() {
  return MODULES;
}

export function getPrimaryTabs() {
  return MODULES.filter((m) => m.primary);
}

export default MODULES;
