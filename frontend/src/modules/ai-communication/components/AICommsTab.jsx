
import { useState, useCallback, useEffect, useMemo } from 'react';
import { analyzeMessage, normalizeNeuroChatConversation } from '../services/aiEngine';
import { getConversations, listConversationDrafts, generateDraft, sendDraft, editDraft } from '../../../services/storage';
import AutoReplyToggle from './AutoReplyToggle';
import AIDraft from './AIDraft';

const toneOptions = ['Professional', 'Friendly', 'Casual', 'Formal'];
const lengthOptions = ['Short', 'Medium', 'Detailed'];

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-[22px] p-2 rounded-lg ${color}`}>{icon}</span>
        <div>
          <p className="text-headline-sm text-on-surface font-bold">{value}</p>
          <p className="text-label-sm text-on-surface-variant">{label}</p>
        </div>
      </div>
    </div>
  );
}

function LiveMessage({ buyer, onGenerateDraft }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors border-b border-outline-variant/50 last:border-b-0">
      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 text-label-md font-bold">
        {buyer.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-label-md text-on-surface font-medium truncate">{buyer.name}</p>
        <p className="text-label-sm text-on-surface-variant line-clamp-1 mt-0.5">{buyer.lastMessage}</p>
      </div>
      <button
        onClick={() => onGenerateDraft(buyer)}
        className="h-8 px-3 bg-primary/10 text-primary rounded-lg text-label-sm font-medium flex items-center gap-1.5 hover:bg-primary/20 transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
        Draft
      </button>
    </div>
  );
}

export default function AICommsTab({ sellerId, onToast }) {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoMode, setAutoMode] = useState('approval');
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState({
    messagesProcessed: 0,
    draftsGenerated: 0,
    sentCount: 0,
  });

  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('Medium');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pendingMessages, setPendingMessages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conversations = await getConversations();
        if (cancelled) return;

        const normalized = await Promise.all(
          conversations.map(async (conversation) => {
            const draftList = await listConversationDrafts(conversation.id);
            const normalizedConversation = normalizeNeuroChatConversation(conversation, draftList);
            return {
              ...normalizedConversation,
              draftList,
            };
          })
        );

        const realPending = normalized
          .filter((item) => item.id)
          .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        const allRawDrafts = realPending.flatMap((conversation) => {
          const draftList = Array.isArray(conversation.draftList) ? conversation.draftList : [];
          return draftList.map((draft) => ({ draft, conversation }));
        });

        const allDrafts = allRawDrafts
          .filter(({ draft }) => (draft.status || 'pending') === 'pending')
          .map(({ draft, conversation }) => ({
            id: draft.id,
            buyerId: conversation.id,
            buyerName: conversation.name,
            buyerMessage: draft.original_message || conversation.lastMessage,
            response: draft.draft_content || draft.response || 'Draft pending review',
            emotion: draft.sentiment_label || 'Neutral',
            strategy: draft.intent || 'Educational',
            leadScore: draft.lead_score ?? null,
            timestamp: draft.created_at || new Date().toISOString(),
          }));

        const sentCount = allRawDrafts.filter(({ draft }) => draft.status === 'sent').length;

        setPendingMessages(realPending);
        setDrafts(allDrafts);
        setStats((prev) => ({
          ...prev,
          messagesProcessed: realPending.reduce((sum, item) => sum + (item.unreadCount || 0), 0) || realPending.length,
          draftsGenerated: allRawDrafts.length,
          sentCount,
        }));
      } catch (err) {
        console.error('Failed to load NeuroChat conversations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sellerId]);

  const handleGenerateDraft = useCallback(async (buyer) => {
    try {
      const draft = await generateDraft(buyer.id);
      const nextDraft = {
        id: draft.id,
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerMessage: draft.original_message || buyer.lastMessage,
        response: draft.draft_content,
        emotion: draft.sentiment_label || 'Neutral',
        strategy: draft.intent || 'Educational',
        leadScore: draft.lead_score ?? null,
        timestamp: draft.created_at || new Date().toISOString(),
      };

      setDrafts((prev) => [nextDraft, ...prev.filter((item) => item.id !== draft.id)]);
      setStats((prev) => ({ ...prev, draftsGenerated: prev.draftsGenerated + 1 }));
      onToast(`AI draft ready for ${buyer.name}`, 'success');
    } catch (err) {
      console.error('Failed to generate draft from live conversation:', err);
      const analysis = analyzeMessage(buyer.lastMessage);
      const draft = {
        id: `draft-${Date.now()}`,
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerMessage: buyer.lastMessage,
        ...analysis,
        timestamp: new Date().toISOString(),
      };
      setDrafts((prev) => [draft, ...prev]);
      onToast('Generated draft locally while the backend processed the request', 'warning');
    }
  }, [onToast]);

  const handleAcceptDraft = useCallback(async (draftId, response) => {
    const draft = drafts.find((item) => item.id === draftId);
    try {
      await sendDraft(draftId);
      setDrafts((prev) => prev.filter((item) => item.id !== draftId));
      setPendingMessages((prev) => prev.filter((message) => message.id !== draft?.buyerId));
      setStats((prev) => ({ ...prev, sentCount: prev.sentCount + 1 }));
      onToast(`Response sent to ${draft?.buyerName}`, 'success');
    } catch (err) {
      console.error('Failed to send approved draft:', err);
      onToast('Failed to send the approved draft', 'error');
    }
  }, [drafts, onToast]);

  const handleEditDraft = useCallback(async (draftId, editedText) => {
    try {
      const draft = drafts.find((item) => item.id === draftId);
      if (draft && draft.id.startsWith('draft-')) {
        setDrafts((prev) => prev.map((item) => item.id === draftId ? { ...item, response: editedText } : item));
      } else {
        await editDraft(draftId, editedText);
        setDrafts((prev) => prev.map((item) => item.id === draftId ? { ...item, response: editedText } : item));
      }
      onToast('Draft updated', 'success');
    } catch (err) {
      console.error('Failed to update draft:', err);
      onToast('Failed to update the draft', 'error');
    }
  }, [drafts, onToast]);

  const handleRewriteDraft = useCallback(async (draftId) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    try {
      const nextDraft = await generateDraft(draft.buyerId);
      setDrafts((prev) => prev.map((item) => item.id === draftId ? {
        ...item,
        response: nextDraft.draft_content,
        emotion: nextDraft.sentiment_label || item.emotion,
        strategy: nextDraft.intent || item.strategy,
        timestamp: nextDraft.created_at || new Date().toISOString(),
      } : item));
      onToast('Draft rewritten', 'success');
    } catch (err) {
      console.error('Failed to rewrite draft:', err);
      const newAnalysis = analyzeMessage(draft.buyerMessage);
      setDrafts((prev) => prev.map((item) => item.id === draftId ? { ...item, ...newAnalysis } : item));
      onToast('Local rewrite applied', 'warning');
    }
  }, [drafts, onToast]);

  const handleDismissDraft = useCallback((draftId) => {
    setDrafts((prev) => prev.filter((item) => item.id !== draftId));
  }, []);

  useEffect(() => {
    if (!autoReplyEnabled || autoMode !== 'auto' || pendingMessages.length === 0) return;

    const timer = setTimeout(() => {
      const buyer = pendingMessages[0];
      handleGenerateDraft(buyer);
    }, 1200);

    return () => clearTimeout(timer);
  }, [autoReplyEnabled, autoMode, pendingMessages, handleGenerateDraft]);

  const approvalRate = stats.draftsGenerated
    ? Math.round((stats.sentCount / stats.draftsGenerated) * 100)
    : 0;

  const avgLeadScore = useMemo(() => {
    const scored = drafts.filter((d) => typeof d.leadScore === 'number');
    if (!scored.length) return null;
    return Math.round(scored.reduce((sum, d) => sum + d.leadScore, 0) / scored.length);
  }, [drafts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">smart_toy</span>
            NeuroChat AI
          </h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            AI-powered communication intelligence for your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <span className={`w-2 h-2 rounded-full ${autoReplyEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {autoReplyEnabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="chat" label="Messages analyzed" value={stats.messagesProcessed.toLocaleString()} color="bg-blue-50 text-blue-600" />
        <StatCard icon="send" label="Responses sent" value={stats.sentCount.toLocaleString()} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon="thumb_up" label="Approval rate" value={`${approvalRate}%`} color="bg-purple-50 text-purple-600" />
        <StatCard icon="trending_up" label="Avg lead score" value={avgLeadScore == null ? '—' : `${avgLeadScore}/100`} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <AutoReplyToggle
          enabled={autoReplyEnabled}
          onToggle={setAutoReplyEnabled}
          mode={autoMode}
          onModeChange={setAutoMode}
        />

        <div className="px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
          <span className="text-label-md text-on-surface font-medium">AI Configuration</span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <span className={`material-symbols-outlined text-[18px] transition-transform ${showSettings ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
        </div>

        {showSettings && (
          <div className="px-4 py-4 space-y-4 bg-surface-container-low">
            <div>
              <label className="text-label-md text-on-surface font-medium block mb-2">Response Tone</label>
              <div className="flex flex-wrap gap-2">
                {toneOptions.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`h-8 px-4 rounded-lg text-label-sm font-medium transition-colors ${
                      tone === t
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-label-md text-on-surface font-medium block mb-2">Response Length</label>
              <div className="flex gap-2">
                {lengthOptions.map(l => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    className={`h-8 px-4 rounded-lg text-label-sm font-medium transition-colors ${
                      length === l
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
                <span className="text-label-md text-on-surface">Auto-include product context</span>
              </div>
              <button
                className="relative w-10 h-5 rounded-full bg-primary transition-colors"
              >
                <span className="absolute top-0.5 left-5 w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          </div>
        )}
      </div>

      {drafts.length > 0 && (
        <div>
          <h2 className="text-title-sm text-on-surface font-semibold mb-2 px-1">AI Drafts ({drafts.length})</h2>
          <div className="space-y-2">
            {drafts.map(draft => (
              <AIDraft
                key={draft.id}
                draft={draft}
                onAccept={(response) => handleAcceptDraft(draft.id, response)}
                onEdit={(editedText) => handleEditDraft(draft.id, editedText)}
                onRewrite={() => handleRewriteDraft(draft.id)}
                onDismiss={() => handleDismissDraft(draft.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h3 className="text-title-sm text-on-surface font-semibold">Incoming Messages</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {pendingMessages.length} message{pendingMessages.length !== 1 ? 's' : ''} awaiting response
            </p>
          </div>
          {autoReplyEnabled && (
            <span className="flex items-center gap-1.5 text-label-sm text-emerald-600 font-medium">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              AI {autoMode === 'auto' ? 'Auto' : 'Drafting'}
            </span>
          )}
        </div>

        {pendingMessages.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30">inbox</span>
            <p className="text-label-md text-on-surface-variant mt-2">All caught up! No pending messages.</p>
          </div>
        ) : (
          <div>
            {pendingMessages.map(buyer => (
              <LiveMessage
                key={buyer.id}
                buyer={buyer}
                onGenerateDraft={handleGenerateDraft}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
