
import { useRef } from 'react';
import { updateSeller } from '../services/storage';
import { getNavTabs } from '../modules/MODULES';

const TABS = getNavTabs();

function SidebarContent({ seller, activeTab, onTabChange, onLogout, onClose, fileInputRef, handleAvatarChange, unreadCount }) {
  const handleTab = (key) => {
    onTabChange(key);
    onClose?.();
  };

  return (
    <>
      <div className="px-4 mb-8 flex flex-col items-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-primary focus:outline-none hover:opacity-90 transition-opacity active:scale-95 duration-200"
          title="Change store photo"
        >
          {seller.avatarImage ? (
            <img src={seller.avatarImage} alt="Store" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">storefront</span>
            </div>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        <h2 className="text-headline-md text-on-surface text-center" style={{ fontWeight: 700 }}>
          {seller.business_name || seller.storeName || 'My Store'}
        </h2>
        {seller.business_type && (
          <p className="text-label-md text-on-surface-variant text-center mt-0.5">{seller.business_type}</p>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto custom-scroll">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && handleTab(tab.key)}
              disabled={tab.disabled}
              title={tab.comingSoon ? 'Coming soon' : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-container/10 border-r-4 border-primary'
                  : tab.disabled
                    ? 'text-on-surface-variant/40 cursor-not-allowed'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
              }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}>
                {tab.icon}
              </span>
              <span className="text-label-md flex-1">{tab.label}</span>
              {tab.key === 'inbox' && unreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1 rounded-full bg-error text-on-error text-label-sm font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {tab.comingSoon && (
                <span className="px-1.5 py-0.5 bg-surface-container rounded text-label-sm text-on-surface-variant/60">Soon</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 mt-auto">
        <div className="border-t border-outline-variant pt-3">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-all duration-200"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-label-md">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ seller, activeTab, onTabChange, onSellerUpdate, onLogout, isOpen, onClose, unreadCount = 0 }) {
  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        await updateSeller(seller.id, { avatarImage: dataUrl });
        onSellerUpdate({ ...seller, avatarImage: dataUrl });
      } catch (err) {
        console.error('Failed to update avatar:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const sharedProps = { seller, activeTab, onTabChange, onLogout, onClose, fileInputRef, handleAvatarChange, unreadCount };

  return (
    <>
      <aside className="hidden lg:flex w-64 h-screen sticky top-0 flex-col py-6 bg-surface-container-low border-r border-outline-variant flex-shrink-0">
        <SidebarContent {...sharedProps} />
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-inverse-surface/40" onClick={onClose} />
          <aside className="w-64 h-full bg-surface-container-low flex flex-col py-6 shadow-2xl animate-slide-in relative">
            <div className="flex justify-end px-4 mb-2">
              <button onClick={onClose}
                className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <SidebarContent {...sharedProps} />
          </aside>
        </div>
      )}
    </>
  );
}
