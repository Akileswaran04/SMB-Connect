
import { useState, useRef, useEffect } from 'react';

const emotionConfig = {
  Excited: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'bolt', label: 'Excited' },
  Interested: { color: 'text-blue-600', bg: 'bg-blue-50', icon: 'interests', label: 'Interested' },
  Frustrated: { color: 'text-red-600', bg: 'bg-red-50', icon: 'mood_bad', label: 'Frustrated' },
  Doubtful: { color: 'text-amber-600', bg: 'bg-amber-50', icon: 'help', label: 'Doubtful' },
  Neutral: { color: 'text-slate-500', bg: 'bg-slate-50', icon: 'remove', label: 'Neutral' },
};

const strategyConfig = {
  'Urgency CTA': { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Urgency CTA' },
  Educational: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Educational' },
  'Social Proof': { color: 'text-purple-600', bg: 'bg-purple-50', label: 'Social Proof' },
  Reassurance: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Reassurance' },
};

export default function AIDraft({ draft, onAccept, onEdit, onRewrite, onDismiss }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(draft.response);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editedText.length, editedText.length);
    }
  }, [isEditing]);

  const emotion = emotionConfig[draft.emotion] || emotionConfig.Neutral;
  const strategy = strategyConfig[draft.strategy] || strategyConfig.Educational;

  const handleSaveEdit = () => {
    onEdit(editedText);
    setIsEditing(false);
  };

  return (
    <div className="mx-4 mb-3 bg-gradient-to-r from-primary-container/30 to-tertiary-container/20 border border-primary/20 rounded-2xl p-4 shadow-sm animate-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
          <span className="text-label-md font-semibold text-on-surface">NeuroChat AI Draft</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-medium ${emotion.color} ${emotion.bg}`}>
          <span className="material-symbols-outlined text-[14px]">{emotion.icon}</span>
          {emotion.label}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-medium ${strategy.color} ${strategy.bg}`}>
          <span className="material-symbols-outlined text-[14px]">psychology</span>
          {strategy.label}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-medium text-on-surface-variant bg-surface-container">
          <span className="material-symbols-outlined text-[14px]">trending_up</span>
          {typeof draft.leadScore === 'number' ? `Lead: ${draft.leadScore}/100` : 'Lead: —'}
        </span>
      </div>

      {isEditing ? (
        <div className="mb-3">
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-primary bg-surface text-body-md text-on-surface focus:ring-1 focus:ring-primary focus:outline-none resize-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSaveEdit}
              className="h-8 px-3 bg-primary text-on-primary rounded-lg text-label-md font-medium hover:bg-primary/90 transition-colors"
            >
              Save Edit
            </button>
            <button
              onClick={() => { setIsEditing(false); setEditedText(draft.response); }}
              className="h-8 px-3 bg-surface-container text-on-surface-variant rounded-lg text-label-md font-medium hover:bg-surface-container-low transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-3 border border-outline-variant/50 mb-3">
          <p className="text-body-md text-on-surface leading-relaxed">{draft.response}</p>
        </div>
      )}

      {!isEditing && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAccept(draft.response)}
            className="flex-1 h-9 bg-primary text-on-primary rounded-lg text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            Accept & Send
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="flex-1 h-9 bg-surface-container border border-outline-variant text-on-surface rounded-lg text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-surface-container-low active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Edit
          </button>
          <button
            onClick={onRewrite}
            className="h-9 px-3 bg-surface-container border border-outline-variant text-on-surface-variant rounded-lg text-label-md font-medium flex items-center justify-center gap-1.5 hover:bg-surface-container-low active:scale-[0.98] transition-all"
            title="Generate a new draft"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      )}
    </div>
  );
}
