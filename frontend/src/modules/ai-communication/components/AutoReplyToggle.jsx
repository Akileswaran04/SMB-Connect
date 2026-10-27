/**
 * "Suggest replies for me" switch. Suggestions are only ever sent when the
 * seller taps Send — there is no unattended auto-send.
 */
import { Icon } from '../../../components/ui';
import { t } from '../../../i18n';

export default function AutoReplyToggle({ enabled, onToggle }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-container-low border-b border-outline-variant">
      <Icon name="auto_awesome" className="text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-label-md text-on-surface font-medium">{t('Suggest replies for me')}</p>
        <p className="text-label-sm text-on-surface-variant">
          {enabled ? t('A reply is written for you. You check it and tap Send.') : t('Off — you type every reply yourself.')}
        </p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={t('Suggest replies for me')} onClick={() => onToggle(!enabled)}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-primary' : 'bg-outline-variant'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
