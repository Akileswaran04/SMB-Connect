
import { useRef } from 'react';
import { updateSeller } from '../services/storage';
import { compressImage } from '../utils/image';
import { t } from '../i18n';

export default function SellerHeader({ seller, onSellerUpdate, onLogout, onMenuToggle, extra }) {
  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const dataUrl = await compressImage(file, { maxSide: 300 });
      await updateSeller(seller.id, { avatarImage: dataUrl });
      onSellerUpdate({ ...seller, avatarImage: dataUrl });
    } catch (err) {
      window.alert(err.message || t('Could not change the shop photo. Please try again.'));
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-surface-container-lowest border-b border-outline-variant">
      <div className="max-w-max-width mx-auto px-4 lg:px-10 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-outline-variant focus:outline-none hover:opacity-90 transition-opacity active:scale-95 duration-200"
            title={t('Change shop photo')}
          >
            {seller.avatarImage ? (
              <img src={seller.avatarImage} alt="Store" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">storefront</span>
              </div>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

          <div className="min-w-0">
            <h1 className="text-headline-md font-bold text-on-surface truncate max-w-[140px] sm:max-w-none">
              {seller.business_name || seller.storeName || t('My shop')}
            </h1>
            {seller.business_type && (
              <span className="text-label-sm text-on-surface-variant truncate block">{seller.business_type}</span>
            )}
          </div>
        </div>

        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="hidden md:flex lg:hidden p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors active:scale-95 duration-200"
            title={t('Menu')} aria-label={t('Menu')}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}

        {extra}
        <button
          onClick={onLogout}
          className="p-2 rounded-full text-primary hover:bg-surface-container transition-colors active:scale-95 duration-200 focus:outline-none flex-shrink-0"
          title={t('Log out')} aria-label={t('Log out')}
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  );
}
