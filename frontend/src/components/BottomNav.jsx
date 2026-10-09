import { getPrimaryTabs, TAB_KEYS } from '../modules/MODULES';

const TABS = getPrimaryTabs();

/** Mobile bottom bar: the four most-used seller tabs plus "More" (full menu). */
export default function BottomNav({ activeTab, onTabChange, unreadCount, onMore }) {
  const inPrimary = TABS.some((t) => t.key === activeTab);
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-40 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around items-center h-16">
        {[...TABS, { key: '__more', icon: 'menu', label: 'More' }].map((tab) => {
          const isActive = tab.key === '__more' ? !inPrimary : activeTab === tab.key;
          const showBadge = tab.key === TAB_KEYS.INBOX && unreadCount > 0;
          return (
            <button
              key={tab.key}
              onClick={() => (tab.key === '__more' ? onMore() : onTabChange(tab.key))}
              className="flex flex-col items-center justify-center w-16 h-14 relative"
            >
              <span className={`flex items-center justify-center rounded-full px-4 py-0.5 ${isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
                <span className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}>{tab.icon}</span>
              </span>
              {showBadge && (
                <span className="absolute top-0 right-2 min-w-[18px] h-[18px] px-1 bg-error text-on-error rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className={`text-label-sm ${isActive ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
