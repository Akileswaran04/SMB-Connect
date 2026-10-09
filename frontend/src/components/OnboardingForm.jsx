
import { useState } from 'react';

const CATEGORIES = [
  'Grocery & Essentials',
  'Clothing & Fashion',
  'Electronics & Accessories',
  'Home & Kitchen',
  'Beauty & Personal Care',
  'Stationery & Office',
  'Handicrafts & Art',
  'Food & Beverages',
  'Health & Wellness',
  'Other',
];

export default function OnboardingForm({ seller, onComplete }) {
  const [form, setForm] = useState({
    storeName: seller.storeName || '',
    category: seller.category || '',
    phone: seller.phone || '',
    address: seller.address || '',
  });
  const [error, setError] = useState('');

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.storeName.trim()) {
      setError('Please enter your store name');
      return;
    }
    if (!form.category) {
      setError('Please select a category');
      return;
    }

    onComplete({
      storeName: form.storeName.trim(),
      category: form.category,
      phone: form.phone.trim(),
      address: form.address.trim(),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <main className="w-full max-w-[440px] bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm">
        <header className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-container/20 text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">celebration</span>
          </div>
          <h1 className="text-headline-lg text-on-surface" style={{ fontWeight: 600 }}>Welcome!</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Set up your store in 30 seconds</p>
        </header>

        {error && (
          <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface" htmlFor="storeName">Store Name *</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">storefront</span>
              <input
                id="storeName"
                type="text"
                value={form.storeName}
                onChange={(e) => update('storeName', e.target.value)}
                placeholder="e.g. Sharma General Store"
                className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                autoFocus
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface" htmlFor="category">Business Category *</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">category</span>
              <select
                id="category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors appearance-none"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface" htmlFor="phone">Phone Number (optional)</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">call</span>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface" htmlFor="address">Store Address (optional)</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">location_on</span>
              <input
                id="address"
                type="text"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Shop 5, Main Market, City"
                className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-12 flex items-center justify-center bg-primary hover:bg-on-primary-fixed-variant text-on-primary text-label-md rounded-lg transition-all active:scale-[0.98] shadow-sm mt-2"
          >
            Start Selling
            <span className="material-symbols-outlined text-[18px] ml-2">arrow_forward</span>
          </button>
        </form>
      </main>
    </div>
  );
}
