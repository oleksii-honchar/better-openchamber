import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useDurationTickerNow } from '@/hooks/useDurationTicker';
import {
  useHasSessionActivityRunningDuration,
  useSessionActivityObservedStartAt,
} from '@/sync/session-activity-timing';
import { formatChatTurnElapsed } from '../../chatTurnElapsedFormat';

/** One update per second: the readout is the animation, at 1 fps instead of 60. */
const TICK_MS = 1000;

/**
 * Elapsed line for the turn running in the session the composer is attached
 * to: `🕐 47s`, rendered inside the composer footer's working/stop cluster so
 * it reads as part of the existing in-turn affordance.
 *
 * Surfaces opt in: the parent only mounts this behind its
 * `runningElapsedVisible` prop (enabled at exactly the webui `MainLayout` and
 * extension `VSCodeLayout` ChatView mounts). This component owns no visibility
 * decision about which turn to count — it shows the line ONLY while the store
 * reports a running turn whose start this client observed. A turn joined
 * mid-turn (snapshot provenance) has no known start and renders nothing at
 * all; the bare working affordance alone is the correct display, and a
 * fabricated `🕐 0s` never appears. When the turn ends the line disappears —
 * unlike the sidebar's counter, this line has no settled tail.
 *
 * Deliberately a leaf (same shape as `SessionActivityDuration`): the 1 fps
 * text swap re-renders this span only, never the composer around it, and the
 * shared ticker channel means one interval per interval value across all
 * visible sessions. No animation, no transition — the swap itself is the
 * motion.
 */
export const ChatTurnElapsedLine: React.FC<{
  /** Session the composer is bound to; null renders nothing. */
  sessionId: string | null;
}> = ({ sessionId }) => {
  const { t } = useI18n();
  const hasRunningDuration = useHasSessionActivityRunningDuration(sessionId ?? '');
  const startedAt = useSessionActivityObservedStartAt(sessionId ?? '');
  const now = useDurationTickerNow(hasRunningDuration, TICK_MS);

  if (!hasRunningDuration || startedAt === undefined) {
    return null;
  }

  const label = formatChatTurnElapsed(Math.max(0, now - startedAt), t);

  return (
    <span
      className="shrink-0 tabular-nums text-primary"
      aria-label={label}
      title={label}
    >
      {label}
    </span>
  );
};
