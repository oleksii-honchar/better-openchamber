import React from 'react';

import { useSessionUIStore } from '@/sync/session-ui-store';
import { useSync } from '@/sync/use-sync';
import { useDirectoryStore, useSyncDirectory } from '@/sync/sync-context';
import { getImperativeSessionMessageLoader } from '@/sync/session-message-loader';
import { shouldRefetchOnFocus } from '@/sync/focus-refetch';

type FocusListenerState = {
    currentSessionId: string | null;
    directory: string | null;
    sync: ReturnType<typeof useSync>;
};

/**
 * Safety net for externally-updated sessions (the platform freshness signal
 * is the fix; this is the fallback, see `@/sync/focus-refetch`). When the
 * tab regains visibility or focus and the OPEN session's loaded message data
 * is older than the staleness window, re-read that one session through the
 * ordinary sync path — what a manual reload would have achieved, at the cost
 * of one request. Event-gated only: no timers, no polling. A session running
 * in this tab is excluded (its live event path already streams).
 *
 * Mount once inside the chat surface (the scope where the open session and
 * its directory are real).
 */
export function useSessionFocusRefetch(): void {
    const currentSessionId = useSessionUIStore((s) => s.currentSessionId);
    const currentSessionDirectory = useSessionUIStore((s) => s.currentSessionDirectory);
    const syncDirectory = useSyncDirectory();
    const sync = useSync();
    const directory = currentSessionDirectory ?? syncDirectory;
    // Passive read access to the directory store (no bootstrap side effect) —
    // the chat surface works on the directory the sync layer already serves.
    const store = useDirectoryStore(directory, { bootstrap: false });

    const stateRef = React.useRef<FocusListenerState & { store: typeof store }>({ currentSessionId, directory, sync, store });
    stateRef.current = { currentSessionId, directory, sync, store };

    const lastAttemptAtRef = React.useRef<Record<string, number>>({});

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const handlePossibleReturn = () => {
            if (document.visibilityState !== 'visible') return;
            const { currentSessionId: sessionID, directory: dir, sync: syncApi, store: dirStore } = stateRef.current;
            if (!sessionID || !dir) return;

            let sessionStatusType: string | null = null;
            try {
                sessionStatusType = dirStore?.getState().session_status?.[sessionID]?.type ?? null;
            } catch {
                sessionStatusType = null;
            }

            const snapshot = getImperativeSessionMessageLoader()?.getSnapshot({ directory: dir, sessionID });
            const key = `${dir}:${sessionID}`;
            if (!shouldRefetchOnFocus({
                now: Date.now(),
                lastDataUpdatedAt: snapshot?.updatedAt,
                lastAttemptAt: lastAttemptAtRef.current[key],
                sessionStatusType,
            })) {
                return;
            }
            lastAttemptAtRef.current[key] = Date.now();
            // Forced authoritative re-read (header + message tail) through the
            // established sync path; dedup/coalescing live inside it.
            void syncApi.ensureSessionRenderable(sessionID, true, dir);
        };

        const onVisibility = () => handlePossibleReturn();
        const onFocus = () => handlePossibleReturn();

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onFocus);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', onFocus);
        };
    }, []);
}
