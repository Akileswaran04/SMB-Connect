/**
 * Text box with a mic: speak instead of typing (in the user's language).
 * Spoken words are added to whatever is already typed.
 */
import useVoiceAssistant from '../hooks/useVoiceAssistant';
import VoiceInputButton from './chat/VoiceInputButton';
import { Input, Textarea } from './ui';
import { getLang } from '../i18n';

export default function VoiceField({ as = 'textarea', value, onChange, className = '', ...props }) {
  const voice = useVoiceAssistant(getLang());
  const Field = as === 'input' ? Input : Textarea;
  const add = (spoken) => onChange({ target: { value: value ? `${value} ${spoken}` : spoken } });
  return (
    <div>
      <div className="relative">
        <Field value={value} onChange={onChange} className={`${voice.supported ? 'pr-12' : ''} ${className}`} {...props} />
        <VoiceInputButton voice={voice} onTranscript={add} className="absolute right-1 top-1 !w-10 !h-10" />
      </div>
      {voice.error && <p className="text-label-sm text-error mt-1">{voice.error}</p>}
    </div>
  );
}
