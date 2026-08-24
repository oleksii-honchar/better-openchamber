import { create } from 'zustand';
import type { Session } from '@opencode-ai/sdk/v2';
import { isSessionPinned } from '@/stores/useSessionPinnedStore';
import { normalizePath } from '@/lib/pathNormalization';

type SessionActivityPhase = 'active' | 'settled';

type SessionOrderingState = {
  rankById: Map<string, number>;
};

export const EMPTY_SESSION_ORDER_RANKS: ReadonlyMap<string, number> = new Map();

const phaseById = new Map<string, SessionActivityPhase>();
const baselineRankById = new Map<string, { created?: number; updated?: number }>();
let lastRank = 0;

export const useSessionOrderingStore = create<SessionOrderingState>(() => ({
  rankById: new Map(),
}));

const nextRank = (): number => {
  lastRank = Math.max(lastRank + 1, Date.now());
  return lastRank;
};

const promoteSessions = (sessionIds: Iterable<string>, useSharedRank = false): void => {
  const ids = [...sessionIds];
  if (ids.length === 0) return;

  useSessionOrderingStore.setState((state) => {
    const rankById = new Map(state.rankById);
    const sharedRank = useSharedRank ? nextRank() : null;
    for (const sessionId of ids) {
      rankById.set(sessionId, sharedRank ?? nextRank());
    }
    return { rankById };
  });
};

export const observeSessionActivityEvent = (
  sessionId: string,
  phase: SessionActivityPhase,
): void => {
  const previous = phaseById.get(sessionId);
  phaseById.set(sessionId, phase);

  if (previous === phase) return;
  if (previous === undefined && phase === 'settled') return;
  promoteSessions([sessionId]);
};

export const reconcileSessionActivitySnapshot = (
  activeSessionIds: Iterable<string>,
  knownSessionIds: Iterable<string>,
): void => {
  const active = new Set(activeSessionIds);
  const observed = new Set([...knownSessionIds, ...active]);
  const promoted: string[] = [];

  for (const sessionId of observed) {
    const phase: SessionActivityPhase = active.has(sessionId) ? 'active' : 'settled';
    const previous = phaseById.get(sessionId);
    phaseById.set(sessionId, phase);
    if (previous !== undefined && previous !== phase) promoted.push(sessionId);
  }

  // A snapshot cannot recover the order of missed transitions. Give the batch
  // one rank and let authoritative timestamps break ties deterministically.
  promoteSessions(promoted, true);
};

export const removeSessionOrdering = (sessionId: string): void => {
  phaseById.delete(sessionId);
  baselineRankById.delete(sessionId);
  useSessionOrderingStore.setState((state) => {
    if (!state.rankById.has(sessionId)) return state;
    const rankById = new Map(state.rankById);
    rankById.delete(sessionId);
    return { rankById };
  });
};

export const resetSessionOrdering = (): void => {
  phaseById.clear();
  baselineRankById.clear();
  lastRank = 0;
  useSessionOrderingStore.setState({ rankById: new Map() });
};

const finiteTime = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const updatedAt = (session: Session): number => (
  finiteTime(session.time?.updated) || finiteTime(session.time?.created)
);

const createdAt = (session: Session): number => finiteTime(session.time?.created);

const parentIdOf = (session: Session): string | null => (
  (session as Session & { parentID?: string | null }).parentID ?? null
);

const sessionDirectory = (session: Session): string | null => {
  const record = session as Session & {
    directory?: string | null;
    project?: { worktree?: string | null } | null;
  };
  return normalizePath(record.directory ?? null) ?? normalizePath(record.project?.worktree ?? null);
};

const baselineRank = (session: Session, pinned: boolean): number => {
  const existing = baselineRankById.get(session.id);
  const key = pinned ? 'created' : 'updated';
  const existingRank = existing?.[key];
  if (existingRank !== undefined) return existingRank;
  const rank = pinned ? createdAt(session) : updatedAt(session);
  baselineRankById.set(session.id, { ...existing, [key]: rank });
  return rank;
};

/**
 * Raise cached baselines to the sessions' current authoritative timestamps.
 *
 * The frozen baseline keeps live metadata churn from reordering an open list,
 * but a client that slept through a session's whole active→settled cycle never
 * saw the transition that would have promoted its live rank — so its stale
 * baseline pins it in place forever. Call this when an authoritative session
 * SNAPSHOT arrives (global refresh); monotonic, so it can never demote.
 */
export const raiseSessionOrderingBaselines = (sessions: Iterable<Session>): void => {
  const currentRanks = useSessionOrderingStore.getState().rankById;
  let nextRanks: Map<string, number> | null = null;
  let baselinesChanged = false;

  for (const session of sessions) {
    const fresh = updatedAt(session);
    const liveRank = currentRanks.get(session.id);
    if (liveRank !== undefined) {
      // A live rank frozen BEFORE this newer authoritative stamp is stale —
      // the session was active again while this client wasn't watching (its
      // transition events never arrived, e.g. another device + sleep). Ranks
      // share the epoch-ms scale with `updated`, so raising is well-ordered.
      if (fresh > liveRank) {
        nextRanks = nextRanks ?? new Map(currentRanks);
        nextRanks.set(session.id, fresh);
      }
      continue;
    }
    const existing = baselineRankById.get(session.id);
    if (existing?.updated !== undefined && existing.updated >= fresh) continue;
    baselineRankById.set(session.id, { ...existing, updated: fresh });
    baselinesChanged = true;
  }

  if (nextRanks) {
    useSessionOrderingStore.setState({ rankById: nextRanks });
  } else if (baselinesChanged) {
    // Baselines live outside the store; nudge subscribers so open lists re-sort.
    useSessionOrderingStore.setState((state) => ({ rankById: new Map(state.rankById) }));
  }
};

export const getSessionLifecycleOrderValue = (
  session: Session,
  rankById: ReadonlyMap<string, number>,
  pinned = false,
): number => rankById.get(session.id) ?? baselineRank(session, pinned);

/**
 * Compute each session's effective activity = the maximum lifecycle value over
 * its whole descendant subtree (itself included). Roots are sessions whose
 * parent is absent from the list (or null), mirroring
 * `orderSessionsByLifecycleScopes`' root detection. This is what drives
 * ROOT-level ordering so a session sorts by its most-recent sub-agent
 * activity, not just its own.
 */
export const buildEffectiveActivityMap = (
  sessions: Session[],
  pinnedSessionIds: Set<string>,
  rankById: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> => {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const childrenByParent = new Map<string, Session[]>();
  for (const session of sessions) {
    const parentId = parentIdOf(session);
    if (!parentId || !sessionIds.has(parentId)) continue;
    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(session);
    } else {
      childrenByParent.set(parentId, [session]);
    }
  }

  const ownValue = new Map<string, number>();
  for (const session of sessions) {
    ownValue.set(
      session.id,
      getSessionLifecycleOrderValue(
        session,
        rankById,
        isSessionPinned(pinnedSessionIds, sessionDirectory(session), session.id),
      ),
    );
  }

  const effective = new Map<string, number>();
  const visit = (sessionId: string, stack: Set<string>): number => {
    const cached = effective.get(sessionId);
    if (cached !== undefined) return cached;
    if (stack.has(sessionId)) return ownValue.get(sessionId) ?? 0;
    stack.add(sessionId);
    let value = ownValue.get(sessionId) ?? 0;
    for (const child of childrenByParent.get(sessionId) ?? []) {
      const childValue = visit(child.id, stack);
      if (childValue > value) value = childValue;
    }
    stack.delete(sessionId);
    effective.set(sessionId, value);
    return value;
  };
  for (const session of sessions) {
    visit(session.id, new Set());
  }
  return effective;
};

export const compareSessionsByLifecycleOrder = (
  left: Session,
  right: Session,
  pinnedSessionIds: Set<string>,
  rankById: ReadonlyMap<string, number>,
  effectiveActivityById?: ReadonlyMap<string, number>,
): number => {
  const leftPinned = isSessionPinned(pinnedSessionIds, sessionDirectory(left), left.id);
  const rightPinned = isSessionPinned(pinnedSessionIds, sessionDirectory(right), right.id);
  if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

  const leftFallback = baselineRank(left, leftPinned);
  const rightFallback = baselineRank(right, rightPinned);
  const sameParentId = parentIdOf(left) === parentIdOf(right);
  if (sameParentId && (!effectiveActivityById || parentIdOf(left) !== null)) {
    // Same-parent scope — siblings under a real parent, or ANY pair when no
    // effective map is provided (byte-identical to the old behavior): own
    // lifecycle rank only.
    const rankDelta = getSessionLifecycleOrderValue(right, rankById, rightPinned)
      - getSessionLifecycleOrderValue(left, rankById, leftPinned);
    if (rankDelta !== 0) return rankDelta;
  } else if (effectiveActivityById) {
    // Cross-parent (including root-vs-root): subtree-wide effective activity.
    const effectiveDelta = (effectiveActivityById.get(right.id) ?? rightFallback)
      - (effectiveActivityById.get(left.id) ?? leftFallback);
    if (effectiveDelta !== 0) return effectiveDelta;
  }

  const baselineDelta = rightFallback - leftFallback;
  if (baselineDelta !== 0) return baselineDelta;
  const createdDelta = baselineRank(right, true) - baselineRank(left, true);
  if (createdDelta !== 0) return createdDelta;
  return left.id.localeCompare(right.id);
};

export const orderSessionsByLifecycleScopes = (
  sessions: Session[],
  pinnedSessionIds: Set<string>,
  rankById: ReadonlyMap<string, number>,
): Session[] => {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const roots: Session[] = [];
  const childrenByParent = new Map<string, Session[]>();

  for (const session of sessions) {
    const parentId = parentIdOf(session);
    if (!parentId || !sessionIds.has(parentId)) {
      roots.push(session);
      continue;
    }

    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(session);
    } else {
      childrenByParent.set(parentId, [session]);
    }
  }

  const compare = (left: Session, right: Session) => (
    compareSessionsByLifecycleOrder(left, right, pinnedSessionIds, rankById)
  );
  const effectiveActivityById = buildEffectiveActivityMap(sessions, pinnedSessionIds, rankById);
  const compareRoots = (left: Session, right: Session) => (
    compareSessionsByLifecycleOrder(left, right, pinnedSessionIds, rankById, effectiveActivityById)
  );
  roots.sort(compareRoots);
  for (const siblings of childrenByParent.values()) {
    siblings.sort(compare);
  }

  const ordered: Session[] = [];
  const visited = new Set<string>();
  const append = (session: Session): void => {
    if (visited.has(session.id)) return;
    visited.add(session.id);
    ordered.push(session);
    for (const child of childrenByParent.get(session.id) ?? []) {
      append(child);
    }
  };
  for (const root of roots) {
    append(root);
  }
  for (const session of sessions) {
    append(session);
  }
  return ordered;
};
