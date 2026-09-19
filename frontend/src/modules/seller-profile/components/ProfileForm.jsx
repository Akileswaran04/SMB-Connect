
import { useState, useRef, useMemo, useEffect } from 'react';
import { updateSeller, computeTrustScore, getReviewCount, getRecentReviews, getMyLanguage, updatePreferredLanguage } from '../../../services/storage';

const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam'];

function LanguagePreference({ onToast }) {
  const [language, setLanguage] = useState('English');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyLanguage().then((lang) => setLanguage(lang === 'en' ? 'English' : lang));
  }, []);

  const save = async (next) => {
    setLanguage(next);
    setSaving(true);
    try {
      await updatePreferredLanguage(next);
      onToast?.('Language preference saved');
    } catch (err) {
      onToast?.(err.message || 'Could not save language', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col-span-1 lg:col-span-12 bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
      <label className="text-label-md text-on-surface font-semibold">Preferred Language</label>
      <p className="text-label-sm text-on-surface-variant mt-0.5 mb-2">Buyer messages are auto-translated into this language for you.</p>
      <select
        value={language}
        onChange={(e) => save(e.target.value)}
        disabled={saving}
        className="w-full h-11 px-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:outline-none"
      >
        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </div>
  );
}

function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function FloatingInput({ label, value, onChange, type = 'text', placeholder, disabled, id }) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ' '}
        disabled={disabled}
        className={`w-full h-14 px-4 pt-5 pb-1 rounded-xl border-2 font-body-lg text-body-lg text-on-surface outline-none transition-all
          ${disabled ? 'border-outline-variant bg-transparent cursor-default' : 'border-outline-variant bg-transparent focus:border-primary'}`}
      />
      <label
        htmlFor={id}
        className={`absolute left-3 px-1 font-label-md text-label-md transition-all pointer-events-none
          ${disabled ? 'text-on-surface-variant' : 'text-on-surface-variant'}
          ${value ? '-top-2.5 bg-surface-container-lowest' : 'top-3.5'}`}
      >
        {label}
      </label>
    </div>
  );
}

function FloatingSelect({ label, value, onChange, options, disabled, id }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full h-14 px-4 pt-5 pb-1 pr-10 rounded-xl border-2 font-body-lg text-body-lg text-on-surface outline-none transition-all appearance-none cursor-pointer
          ${disabled ? 'border-outline-variant bg-transparent cursor-default' : 'border-outline-variant bg-transparent focus:border-primary'}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <label
        htmlFor={id}
        className="absolute left-3 -top-2.5 px-1 font-label-md text-label-md bg-surface-container-lowest pointer-events-none text-on-surface-variant"
      >
        {label}
      </label>
      {!disabled && (
        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
      )}
    </div>
  );
}

function FloatingTextarea({ label, value, onChange, rows = 4, placeholder, disabled, id, maxLength }) {
  return (
    <div className="relative">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ' '}
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        className={`w-full px-5 pt-5 pb-8 rounded-xl border-2 font-body-lg text-body-lg text-on-surface outline-none transition-all resize-y min-h-[120px]
          ${disabled ? 'border-outline-variant bg-transparent cursor-default' : 'border-outline-variant bg-transparent focus:border-primary'}`}
      />
      <label
        htmlFor={id}
        className="absolute left-4 -top-2.5 px-1 font-label-md text-label-md bg-surface-container-lowest pointer-events-none text-on-surface-variant"
      >
        {label}
      </label>
      {maxLength && (
        <span className="absolute bottom-3 right-4 bg-surface-container-lowest px-2 py-0.5 rounded text-label-sm text-on-surface-variant font-medium">
          {value.length} <span className="opacity-50">/ {maxLength}</span>
        </span>
      )}
    </div>
  );
}

function TrustGauge({ score, reviewCount }) {
  const isNew = score === null || score === undefined;
  const displayScore = isNew ? 0 : score;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (displayScore / 5) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28 flex items-center justify-center mb-4">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle className="stroke-surface-container-highest" cx="50" cy="50" fill="transparent" r="40" strokeWidth="7" />
          {!isNew && (
            <circle
              className="stroke-primary transition-all duration-700 ease-out"
              cx="50" cy="50" fill="transparent" r="40"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeWidth="7"
            />
          )}
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className="text-headline-xl font-headline-xl text-primary" style={{ fontWeight: 700 }}>
            {isNew ? '—' : score.toFixed(1)}
          </span>
          {!isNew && <span className="text-label-sm text-on-surface-variant">/ 5.0</span>}
          {isNew && <span className="text-label-sm text-on-surface-variant">New Seller</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Trust Score</h3>
      </div>

      {!isNew && (
        <div className="flex items-center gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <span
              key={s}
              className="material-symbols-outlined text-[18px]"
              style={{
                color: '#F59E0B',
                fontVariationSettings: s <= Math.round(score) ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {s <= Math.floor(score) ? 'star' : s - 0.5 <= score ? 'star_half' : 'star'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileForm({ seller, products = [], onSellerUpdate, onToast }) {
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [coverImage, setCoverImage] = useState(seller.coverImage || null);
  const [avatarImage, setAvatarImage] = useState(seller.avatarImage || null);
  const [documents, setDocuments] = useState(seller.documents || []);
  const [loading, setLoading] = useState(false);

  const { trustScore, reviewCount, recentReviews, totalProducts } = useMemo(() => ({
    trustScore: computeTrustScore(products),
    reviewCount: getReviewCount(products),
    recentReviews: getRecentReviews(products, 10),
    totalProducts: products.length,
  }), [products]);

  const [form, setForm] = useState({
    storeName: seller.business_name || seller.storeName || '',
    category: seller.business_type || seller.category || '',
    bio: seller.description || seller.bio || '',
    phone: seller.phone || '',
    email: seller.email || '',
    address: seller.address_line_1 || seller.address || '',
    hours: seller.hours || '',
  });

  const memberSince = seller.created_at || seller.createdAt ? new Date(seller.created_at || seller.createdAt) : new Date();
  const monthsOld = Math.max(1, Math.floor((new Date() - memberSince) / (30 * 86400000)));

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await updateSeller(seller.id, { ...form, documents, coverImage, avatarImage });
      if (updated) onSellerUpdate(updated);
      setEditing(false);
      onToast('Profile saved!');
    } catch (err) {
      onToast('Failed to save profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({
      storeName: seller.business_name || seller.storeName || '',
      category: seller.business_type || seller.category || '',
      bio: seller.description || seller.bio || '',
      phone: seller.phone || '', email: seller.email || '',
      address: seller.address_line_1 || seller.address || '',
      hours: seller.hours || '',
    });
    setDocuments(seller.documents || []);
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setCoverImage(ev.target.result);
      if (!editing) {
        try {
          await updateSeller(seller.id, { coverImage: ev.target.result });
          onSellerUpdate({ ...seller, coverImage: ev.target.result });
        } catch (err) {
          console.error('Failed to update cover:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setAvatarImage(ev.target.result);
      if (!editing) {
        try {
          await updateSeller(seller.id, { avatarImage: ev.target.result });
          onSellerUpdate({ ...seller, avatarImage: ev.target.result });
        } catch (err) {
          console.error('Failed to update avatar:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-display-lg text-on-surface" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>My Profile</h2>
          <p className="text-body-md text-on-surface-variant mt-2">Manage your store details, public presence, and verification documents.</p>
        </div>
      </div>

      <div className="relative h-52 sm:h-64 rounded-t-2xl overflow-hidden shadow-md">
        {coverImage ? (
          <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary-container/30 to-tertiary-container/20 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-[72px] text-primary/40 block">storefront</span>
              <p className="text-body-md text-on-surface-variant/50 mt-1">Add a cover photo to personalize your store</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        <button
          onClick={() => coverInputRef.current?.click()}
          className="absolute top-4 right-4 p-2.5 bg-surface-container-lowest/80 hover:bg-surface-container-lowest text-on-surface-variant rounded-full transition-colors backdrop-blur-sm"
          title="Change cover photo"
        >
          <span className="material-symbols-outlined text-[20px]">photo_camera</span>
        </button>
        <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 -mt-12 relative z-10">
        <div className="col-span-1 lg:col-span-4 bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm flex flex-col overflow-hidden">
          <div className="relative pt-8 pb-6 px-6 bg-gradient-to-b from-primary-container/10 to-transparent">
            <div className="flex flex-col items-center relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-surface-container-lowest shadow-lg relative z-10">
                {avatarImage ? (
                  <img src={avatarImage} alt="Store" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary-container text-on-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[40px]">storefront</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute top-20 right-[calc(50%-56px)] p-1.5 bg-surface-container-lowest border border-outline-variant rounded-full shadow-md hover:bg-surface-container transition-colors z-20"
                title="Change photo"
              >
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant">photo_camera</span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

              <h2 className="font-headline-lg text-headline-lg text-on-surface text-center mt-4">{seller.business_name || seller.storeName || 'Your Store'}</h2>
              {(seller.business_type || seller.category) && (
                <span className="mt-2 px-3 py-1 bg-primary-container/15 text-primary rounded-full text-label-sm font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">category</span>
                  {seller.business_type || seller.category}
                </span>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 flex flex-col flex-grow">
            <TrustGauge score={trustScore} reviewCount={reviewCount} />

            <div className="mt-4 pt-4 border-t border-outline-variant">
              <p className="text-body-sm text-on-surface-variant flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
                {trustScore !== null
                  ? `Based on ${reviewCount} verified review${reviewCount !== 1 ? 's' : ''}.`
                  : 'Complete your first sale and get reviews to earn a trust score.'}
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline-lg text-headline-lg text-on-surface">Store Details</h3>
            {(seller.business_type || seller.category) && (
              <span className="px-3 py-1.5 bg-primary-container/15 text-primary rounded-full text-label-sm font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">category</span>
                {seller.business_type || seller.category}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FloatingInput id="store_name" label="Store Name" value={form.storeName}
              onChange={(v) => update('storeName', v)} disabled={!editing} />
            <FloatingSelect id="store_category" label="Primary Category" value={form.category}
              onChange={(v) => update('category', v)} disabled={!editing}
              options={[
                { value: 'Food & Beverages', label: 'Food & Beverages' },
                { value: 'Grocery & Essentials', label: 'Grocery & Essentials' },
                { value: 'Clothing & Fashion', label: 'Clothing & Fashion' },
                { value: 'Electronics & Accessories', label: 'Electronics & Accessories' },
                { value: 'Home & Kitchen', label: 'Home & Kitchen' },
                { value: 'Manufacturing & Supply', label: 'Manufacturing & Supply' },
                { value: 'Retail', label: 'Retail' },
                { value: 'Business Services', label: 'Business Services' },
                { value: 'Other', label: 'Other' },
              ]} />
            <FloatingInput id="store_email" label="Contact Email" value={form.email}
              onChange={(v) => update('email', v)} type="email" disabled={!editing} />
            <FloatingInput id="store_phone" label="Support Phone" value={form.phone}
              onChange={(v) => update('phone', v)} type="tel" disabled={!editing} />
            <FloatingInput id="store_address" label="Business Address" value={form.address}
              onChange={(v) => update('address', v)} disabled={!editing} />
            <FloatingInput id="store_hours" label="Business Hours" value={form.hours}
              onChange={(v) => update('hours', v)} disabled={!editing} />
          </div>
        </div>

        <LanguagePreference onToast={onToast} />

        <div className="col-span-1 lg:col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: 'inventory_2', label: 'Products', value: totalProducts, color: 'text-primary bg-primary-container/15' },
              { icon: 'star', label: 'Avg Rating', value: trustScore !== null ? `${trustScore.toFixed(1)} / 5` : '—', color: 'text-amber-600 bg-amber-50' },
              { icon: 'chat_bubble', label: 'Reviews', value: reviewCount, color: 'text-secondary bg-secondary-container/30' },
              { icon: 'event', label: 'Member Since', value: `${monthsOld}mo`, color: 'text-tertiary bg-tertiary-container/30' },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 flex flex-col items-center text-center shadow-sm">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                  <span className="material-symbols-outlined text-[22px]">{stat.icon}</span>
                </div>
                <span className="font-headline-md text-headline-md text-on-surface">{stat.value}</span>
                <span className="text-label-sm text-on-surface-variant mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-12 bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-primary">storefront</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg text-on-surface">About Us</h3>
            </div>
            <span className="font-label-sm text-label-sm text-primary bg-primary-container/15 px-3 py-1.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              Public
            </span>
          </div>
          <FloatingTextarea id="store_bio" label="Store Biography" value={form.bio}
            onChange={(v) => update('bio', v)} disabled={!editing}
            placeholder="Describe your business, values, and what you offer to customers..."
            maxLength={500} rows={4} />
        </div>

        <div className="col-span-1 lg:col-span-12 bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-primary">description</span>
              </div>
              <div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface">Business Documents</h3>
                <p className="text-body-md text-on-surface-variant mt-0.5">Manage your operational licenses and certifications.</p>
              </div>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low/30">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/25">upload_file</span>
              <p className="text-body-md text-on-surface-variant mt-3">No documents uploaded yet</p>
              <p className="text-body-sm text-on-surface-variant/60 mt-1">Upload licenses, certifications, or business permits</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low hover:border-primary transition-all group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.status === 'verified' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#FFF8E1] text-[#F57F17]'}`}>
                      <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors truncate">{doc.name}</h4>
                      <p className="text-label-sm text-on-surface-variant mt-0.5">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm flex items-center gap-1.5 shadow-sm border ${doc.status === 'verified' ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]' : 'bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]'}`}>
                    <span className="material-symbols-outlined text-[16px]">{doc.status === 'verified' ? 'check_circle' : 'schedule'}</span>
                    {doc.status === 'verified' ? 'Verified' : 'Pending Review'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {recentReviews.length > 0 && (
          <div className="col-span-1 lg:col-span-12 bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface">Recent Activity</h3>
              </div>
              <span className="text-label-sm text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-full">Last {recentReviews.length} reviews</span>
            </div>
            <div className="space-y-0">
              {recentReviews.map((review, i) => (
                <div key={review.id || i} className="relative">
                  {i < recentReviews.length - 1 && (
                    <div className="absolute left-5 top-12 bottom-0 w-px bg-outline-variant" />
                  )}
                  <div className="flex gap-4 py-4">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-sm font-bold flex-shrink-0 relative z-10">
                      {review.customerName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-label-md text-on-surface">
                            <span className="font-semibold">{review.customerName}</span>
                            {' '}left a review on{' '}
                            <span className="font-medium text-primary">{review.productName}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <span key={s} className="material-symbols-outlined text-[14px]" style={{ color: s <= review.rating ? '#f59e0b' : '#bcc9c6' }}>star</span>
                              ))}
                            </span>
                            <span className="text-label-sm text-on-surface-variant">{getTimeAgo(review.date)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-body-md text-on-surface-variant mt-2 leading-relaxed">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="col-span-1 lg:col-span-12 flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
          {editing ? (
            <>
              <button onClick={handleCancel}
                className="h-12 px-6 rounded-full border border-outline text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
                <span className="material-symbols-outlined text-[18px]">close</span>
                Cancel
              </button>
              <button onClick={handleSave} disabled={loading}
                className="h-12 px-8 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:shadow-md hover:bg-primary/90 active:scale-95 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 w-full sm:w-auto">
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Save Changes
                  </>
                )}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="h-12 px-8 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:shadow-md hover:bg-primary/90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 w-full sm:w-auto">
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
