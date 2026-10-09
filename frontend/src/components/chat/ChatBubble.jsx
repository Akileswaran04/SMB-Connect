/**
 * One chat message. Messages from the other side are shown in the reader's
 * language when a translation exists (original one tap away), and any
 * message can be played aloud — voice-to-voice across languages (PRD §16).
 */
import { useState } from 'react';
import { Icon } from '../ui';

export default function ChatBubble({ message: m, mine, onSpeak }) {
  const translated = !!m.translatedText && !mine;
  const [showOriginal, setShowOriginal] = useState(false);
  const text = translated && !showOriginal ? m.translatedText : m.text;
  const speakLang = translated && !showOriginal ? m.translatedLanguage : undefined;

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className="max-w-[80%]">
        <div className={`px-3.5 py-2.5 text-body-md leading-relaxed rounded-2xl ${
          mine ? 'bg-primary text-on-primary rounded-br-md' : 'bg-surface-container-low text-on-surface border border-outline-variant/50 rounded-bl-md'
        }`}>
          {m.messageType === 'voice' && (
            <span className={`flex items-center gap-1 text-label-sm mb-0.5 ${mine ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
              <Icon name="mic" size={14} /> Voice message
            </span>
          )}
          {text}
        </div>
        <div className={`flex items-center gap-2 mt-0.5 ${mine ? 'justify-end' : 'justify-start'}`}>
          <span className="text-label-sm text-on-surface-variant">
            {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
          {onSpeak && (
            <button onClick={() => onSpeak(text, speakLang)} className="text-primary" aria-label="Play message aloud" title="Play aloud">
              <Icon name="volume_up" size={14} />
            </button>
          )}
          {translated && (
            <button onClick={() => setShowOriginal((v) => !v)} className="inline-flex items-center gap-0.5 text-label-sm text-primary">
              <Icon name="translate" size={12} />
              {showOriginal ? 'Show translation' : 'Show original'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
