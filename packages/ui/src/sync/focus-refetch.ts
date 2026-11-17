/**
 * Focus-refetch safety net (pure decision core).
 *
 * The FIX for foreign writers is the platform freshness signal (the server's
 * session-store watcher announces externally-changed sessions and the sync
 * layer re-reads them). This gate is the safety net for when a client missed
 * the signal entirely (closed background tab, event stream dead): when the
 * tab regains visibility/focus and the open session's message data is older
 * than a short window, re-fetch that one session through the ordinary sync
 * path — exactly what a manual reload would have done.
 *
 * Deliberately dumb and cheap: no timers, no polling, no history — a single
 * pure function over (now, last data time, last attempt, session status).
 */

/** Data older than this is considered stale enough to re-read on focus. */
export const FOCUS_REFETCH_STALE_MS = 30_000;

/** Floor between attempts so rapid focus ping-pong cannot hammer the server
 * while a slow fetch is completing. */
export const FOCUS_REFETCH_MIN_ATTEMPT_GAP_MS = 5_000;

export type FocusRefetchGateInput = {
  now: number;
  /** Loader snapshot `updatedAt` for the open session — undefined when the
   * session has never completed a load (the ordinary load path owns that). */
  lastDataUpdatedAt: number | undefined;
  /** Date.now() of the previous focus-refetch attempt for this session. */
  lastAttemptAt?: number;
  /** Open session's live status type from the sync store, if any. */
  sessionStatusType?: string | null;
};

export function shouldRefetchOnFocus(input: FocusRefetchGateInput): boolean {
  // A session running HERE is already updated by the live event path.
  if (input.sessionStatusType === 'busy' || input.sessionStatusType === 'retry') {
    return false;
  }
  // Never-loaded data is the initial-load path's job, not a freshness bug.
  if (typeof input.lastDataUpdatedAt !== 'number') {
    return false;
  }
  if (typeof input.lastAttemptAt === 'number' && input.now - input.lastAttemptAt < FOCUS_REFETCH_MIN_ATTEMPT_GAP_MS) {
    return false;
  }
  return input.now - input.lastDataUpdatedAt > FOCUS_REFETCH_STALE_MS;
}
