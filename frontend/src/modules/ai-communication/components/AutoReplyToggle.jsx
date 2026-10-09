
import { useState } from 'react';

export default function AutoReplyToggle({ enabled, onToggle, mode, onModeChange }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container-low border-b border-outline-variant">
        <span className="material-symbols-outlined text-[20px] text-primary">auto_awesome</span>

        <div className="flex-1 min-w-0">
          <p className="text-label-md text-on-surface font-medium">NeuroChat Auto-Reply</p>
          <p className="text-label-sm text-on-surface-variant">
            {enabled
              ? mode === 'approval' ? 'AI drafts responses for your review' : 'AI sends responses automatically'
              : 'Manual replies only'
            }
          </p>
        </div>

        {enabled && (
          <div className="flex items-center bg-surface rounded-lg p-0.5 border border-outline-variant">
            <button
              onClick={() => onModeChange('approval')}
              className={`px-2.5 py-1 rounded-md text-label-sm font-medium transition-colors ${
                mode === 'approval'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => onModeChange('auto')}
              className={`px-2.5 py-1 rounded-md text-label-sm font-medium transition-colors ${
                mode === 'auto'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Auto
            </button>
          </div>
        )}

        <button
          onClick={() => onToggle(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            enabled ? 'bg-primary' : 'bg-surface-container-highest'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">info</span>
        </button>
      </div>

      {showInfo && (
        <div className="px-4 py-3 bg-primary-container/10 border-b border-outline-variant text-label-sm text-on-surface-variant space-y-1.5">
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">check_circle</span>
            <span><strong>Review mode:</strong> AI analyzes customer emotion and drafts a response. You approve, edit, or rewrite before sending.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5">bolt</span>
            <span><strong>Auto mode:</strong> AI responds instantly using sentiment analysis and persuasion strategies. No review needed.</span>
          </p>
        </div>
      )}
    </div>
  );
}
