
import { useState } from 'react';
import ConversationList from './ConversationList';
import ChatView from './ChatView';

export default function InboxTab({ sellerId, onToast, onRefresh }) {
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col lg:flex-row gap-0 bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 160px)', minHeight: '500px' }}>
      <div className={`${selectedConvo ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-96 border-r border-outline-variant flex-shrink-0`}>
        <ConversationList
          key={refreshKey}
          sellerId={sellerId}
          selectedId={selectedConvo}
          onSelect={setSelectedConvo}
        />
      </div>

      <div className={`${selectedConvo ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-w-0`}>
        {selectedConvo ? (
          <ChatView
            conversationId={selectedConvo}
            sellerId={sellerId}
            onBack={() => setSelectedConvo(null)}
            onRefresh={() => { handleRefresh(); onRefresh?.(); }}
            onToast={onToast}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8">
            <span className="material-symbols-outlined text-[64px] opacity-30">chat</span>
            <p className="text-headline-md mt-4" style={{ fontWeight: 600 }}>Your Inbox</p>
            <p className="text-body-md text-center mt-2 max-w-sm">
              Select a conversation to view messages, or start a new chat with a customer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
