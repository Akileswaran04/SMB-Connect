/**
 * A suggested reply written by the AI. Nothing is sent until the seller taps
 * "Send this reply" (or changes it first). Shows how the buyer seems to feel,
 * in plain words — no marketing jargon.
 */
import { useState, useRef, useEffect } from 'react';
import { Icon } from '../../../components/ui';
import { t } from '../../../i18n';

const MOOD = {
  Excited: { tone: 'text-emerald-700 bg-emerald-50', icon: 'sentiment_satisfied', label: 'Buyer seems happy' },
  Frustrated: { tone: 'text-red-700 bg-red-50', icon: 'sentiment_dissatisfied', label: 'Buyer seems upset — reply kindly' },
  Neutral: null,
};

export default function AIDraft({ draft, onAccept, onEdit, onRewrite, onDismiss }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(draft.response);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const mood = MOOD[draft.emotion];
  const btn = 'h-11 rounded-lg text-label-md font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all';

  return (
    <div className="mx-4 mb-3 bg-primary-container/15 border border-primary/25 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-label-md font-semibold text-on-surface">
          <Icon name="auto_awesome" size={18} className="text-primary" />{t('Suggested reply')}
        </span>
        <button onClick={onDismiss} aria-label={t('Close')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant">
          <Icon name="close" size={18} />
        </button>
      </div>

      {mood && (
        <p className={`inline-flex items-center gap-1 px-2 py-1 mb-2 rounded-full text-label-sm font-medium ${mood.tone}`}>
          <Icon name={mood.icon} size={16} />{t(mood.label)}
        </p>
      )}

      {isEditing ? (
        <div className="mb-1">
          <textarea ref={textareaRef} value={editedText} onChange={(e) => setEditedText(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-xl border border-primary bg-surface text-body-md text-on-surface focus:ring-1 focus:ring-primary focus:outline-none resize-none" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { onEdit(editedText); setIsEditing(false); }} className={`${btn} flex-1 bg-primary text-on-primary`}>
              <Icon name="send" size={18} />{t('Send')}
            </button>
            <button onClick={() => { setIsEditing(false); setEditedText(draft.response); }} className={`${btn} px-4 bg-surface-container text-on-surface-variant`}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="bg-surface rounded-xl p-3 border border-outline-variant/50 mb-3 text-body-md text-on-surface leading-relaxed">{draft.response}</p>
          <div className="flex gap-2">
            <button onClick={() => onAccept(draft.response)} className={`${btn} flex-1 bg-primary text-on-primary`}>
              <Icon name="send" size={18} />{t('Send this reply')}
            </button>
            <button onClick={() => setIsEditing(true)} className={`${btn} px-4 bg-surface-container border border-outline-variant text-on-surface`}>
              <Icon name="edit" size={18} />{t('Change')}
            </button>
            <button onClick={onRewrite} title={t('Suggest a different reply')} aria-label={t('Suggest a different reply')}
              className={`${btn} w-11 bg-surface-container border border-outline-variant text-on-surface-variant`}>
              <Icon name="refresh" size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
