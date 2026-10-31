import type { I18nKey, I18nParams } from '@/lib/i18n';
import { formatSessionActivityDuration } from '@/components/session/sessionActivityDurationFormat';

type Translate = (key: I18nKey, params?: I18nParams) => string;

/**
 * Complete chat-surface message for the time the current turn has been
 * running: `🕐 {duration}`.
 *
 * The message is a single complete key, shared byte-for-byte by every locale
 * because its text is an emoji plus a placeholder. The duration itself is
 * produced by the shared turn formatter, so the unit suffixes come from each
 * locale's existing `common.duration.*` keys and no unit text is ever
 * concatenated here.
 */
export const formatChatTurnElapsed = (durationMs: number, t: Translate): string => {
  return t('chat.statusRow.runningFor', {
    duration: formatSessionActivityDuration(durationMs, t),
  });
};
