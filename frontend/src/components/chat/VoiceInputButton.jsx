/**
 * Mic button: speech-to-text in the user's language, handing the transcript
 * to `onTranscript`. Hidden where the browser has no speech recognition.
 */
import { Icon } from '../ui';
import { t } from '../../i18n';

export default function VoiceInputButton({ voice, onTranscript, className = '' }) {
  if (!voice.supported) return null;
  const toggle = () => (voice.listening ? voice.stopListening() : voice.startListening(onTranscript));
  return (
    <button
      type="button"
      onClick={toggle}
      title={voice.listening ? t('Stop listening') : t('Speak')}
      aria-label={voice.listening ? t('Stop listening') : t('Speak')}
      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        voice.listening ? 'bg-error text-on-error animate-pulse' : 'bg-surface-container text-on-surface-variant hover:text-primary'
      } ${className}`}
    >
      <Icon name={voice.listening ? 'graphic_eq' : 'mic'} />
    </button>
  );
}
