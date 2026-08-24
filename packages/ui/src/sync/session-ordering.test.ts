import { beforeEach, describe, expect, test } from 'bun:test';
import type { Session } from '@opencode-ai/sdk/v2';
import { getPinnedSessionKey } from '@/stores/useSessionPinnedStore';
import { getRuntimeKey } from '@/lib/runtime-switch';
import {
  compareSessionsByLifecycleOrder,
  observeSessionActivityEvent,
  orderSessionsByLifecycleScopes,
  reconcileSessionActivitySnapshot,
  removeSessionOrdering,
  resetSessionOrdering,
  useSessionOrderingStore,
  raiseSessionOrderingBaselines,
} from './session-ordering';

const pinnedKeyFor = (directory: string, sessionId: string): string => {
  const key = getPinnedSessionKey(getRuntimeKey(), directory, sessionId);
  if (!key) throw new Error('failed to build pinned key');
  return key;
};

const sessionWithDirectory = (
  id: string,
  updated: number,
  directory: string,
  parentID?: string,
): Session => ({
  id,
  parentID,
  directory,
  time: { created: updated - 1, updated },
} as Session);

const session = (
  id: string,
  updated: number,
  parentID?: string,
): Session => ({
  id,
  parentID,
  time: { created: updated - 1, updated },
} as Session);

beforeEach(() => resetSessionOrdering());

describe('session lifecycle ordering', () => {
  test('promotes only meaningful event transitions', () => {
    observeSessionActivityEvent('session-a', 'settled');
    expect(useSessionOrderingStore.getState().rankById.has('session-a')).toBe(false);

    observeSessionActivityEvent('session-a', 'active');
    const activeRank = useSessionOrderingStore.getState().rankById.get('session-a');
    expect(typeof activeRank).toBe('number');

    observeSessionActivityEvent('session-a', 'active');
    expect(useSessionOrderingStore.getState().rankById.get('session-a')).toBe(activeRank);

    observeSessionActivityEvent('session-a', 'settled');
    expect(useSessionOrderingStore.getState().rankById.get('session-a')).toBeGreaterThan(activeRank ?? 0);
  });

  test('treats an active event without a snapshot baseline as a real transition', () => {
    observeSessionActivityEvent('session-a', 'active');

    expect(useSessionOrderingStore.getState().rankById.has('session-a')).toBe(true);
  });

  test('seeds the first authoritative snapshot without synthetic promotions', () => {
    reconcileSessionActivitySnapshot(['session-a'], ['session-a', 'session-b']);
    expect(useSessionOrderingStore.getState().rankById.size).toBe(0);

    reconcileSessionActivitySnapshot([], ['session-a', 'session-b']);
    expect(useSessionOrderingStore.getState().rankById.has('session-a')).toBe(true);
    expect(useSessionOrderingStore.getState().rankById.has('session-b')).toBe(false);
  });

  test('uses lifecycle rank only within the same parent scope', () => {
    const rootOlder = session('root-older', 10);
    const rootNewer = session('root-newer', 20);
    const childOlder = session('child-older', 10, 'root-older');
    const childNewer = session('child-newer', 20, 'root-older');
    const otherParentChild = session('other-parent-child', 20, 'root-newer');
    const rankById = new Map([
      ['child-older', 100],
      ['root-older', 90],
    ]);

    expect(compareSessionsByLifecycleOrder(rootOlder, rootNewer, new Set(), rankById)).toBeLessThan(0);
    expect(compareSessionsByLifecycleOrder(childOlder, childNewer, new Set(), rankById)).toBeLessThan(0);
    expect(compareSessionsByLifecycleOrder(childOlder, otherParentChild, new Set(), rankById)).toBeGreaterThan(0);
    expect(compareSessionsByLifecycleOrder(childOlder, rootNewer, new Set(), rankById)).toBeGreaterThan(0);
  });

  test('freezes timestamp fallback until a lifecycle transition', () => {
    const older = session('older', 10);
    const newer = session('newer', 20);
    expect(compareSessionsByLifecycleOrder(older, newer, new Set(), new Map())).toBeGreaterThan(0);

    const metadataOnlyUpdate = session('older', 30);
    expect(compareSessionsByLifecycleOrder(metadataOnlyUpdate, newer, new Set(), new Map())).toBeGreaterThan(0);

    expect(compareSessionsByLifecycleOrder(
      metadataOnlyUpdate,
      newer,
      new Set(),
      new Map([['older', 40]]),
    )).toBeLessThan(0);
  });

  test('clears lifecycle state when a session is deleted', () => {
    observeSessionActivityEvent('session-a', 'active');
    removeSessionOrdering('session-a');
    expect(useSessionOrderingStore.getState().rankById.has('session-a')).toBe(false);

    observeSessionActivityEvent('session-a', 'settled');
    expect(useSessionOrderingStore.getState().rankById.has('session-a')).toBe(false);
  });

  test('sorts each forest scope before flattening parent-first', () => {
    const rootOlder = session('root-older', 10);
    const rootNewer = session('root-newer', 20);
    const childOlder = session('child-older', 5, 'root-older');
    const childNewer = session('child-newer', 6, 'root-older');

    const ordered = orderSessionsByLifecycleScopes(
      [rootNewer, childOlder, rootOlder, childNewer],
      new Set(),
      new Map([
        ['root-older', 100],
        ['child-older', 90],
      ]),
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'root-older',
      'child-older',
      'child-newer',
      'root-newer',
    ]);
  });

  test('promotes a root when only its child has lifecycle activity', () => {
    const rootOlder = session('root-older', 10);
    const rootNewer = session('root-newer', 20);
    const activeChild = session('active-child', 5, 'root-older');

    const ordered = orderSessionsByLifecycleScopes(
      [rootOlder, activeChild, rootNewer],
      new Set(),
      new Map([['active-child', 100]]),
    );

    // The child's live rank (100) bubbles the parent root above the root with
    // the newer own update (20). Previously the child's activity was ignored
    // for root ordering; effective subtree activity is the new behavior.
    expect(ordered.map((item) => item.id)).toEqual([
      'root-older',
      'active-child',
      'root-newer',
    ]);
  });

  test('authoritative snapshot raises frozen baselines without live ranks', () => {
    const older = session('older', 10);
    const newer = session('newer', 20);
    // Freeze both baselines at their first-seen timestamps.
    expect(compareSessionsByLifecycleOrder(older, newer, new Set(), new Map())).toBeGreaterThan(0);

    // A metadata-only live update must NOT reorder (frozen baseline)...
    const liveBump = session('older', 30);
    expect(compareSessionsByLifecycleOrder(liveBump, newer, new Set(), new Map())).toBeGreaterThan(0);

    // ...but an authoritative snapshot with the newer stamp raises the baseline.
    raiseSessionOrderingBaselines([liveBump, newer]);
    expect(compareSessionsByLifecycleOrder(liveBump, newer, new Set(), new Map())).toBeLessThan(0);
  });

  test('store-held stale live rank is raised by an authoritative snapshot', () => {
    useSessionOrderingStore.setState({ rankById: new Map([['stale', 15]]) });
    raiseSessionOrderingBaselines([session('stale', 40)]);
    expect(useSessionOrderingStore.getState().rankById.get('stale')).toBe(40);
  });

  test('promotes a root whose descendant sub-agent has newer activity above a root with a newer own update', () => {
    const parentWithSubagent = session('parent-with-subagent', 10);
    const subagent = session('sub-agent', 200, 'parent-with-subagent');
    const rootNewer = session('root-newer', 20);

    const ordered = orderSessionsByLifecycleScopes(
      [parentWithSubagent, subagent, rootNewer],
      new Set(),
      new Map(),
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'parent-with-subagent',
      'sub-agent',
      'root-newer',
    ]);
  });

  test('live sub-agent activity promotes the parent root without a direct event on the parent', () => {
    observeSessionActivityEvent('sub-agent', 'active');
    const rankById = useSessionOrderingStore.getState().rankById;
    expect(rankById.has('sub-agent')).toBe(true);

    const parentWithSubagent = session('parent-with-subagent', 10);
    const subagent = session('sub-agent', 5, 'parent-with-subagent');
    const rootNewer = session('root-newer', 20);

    const ordered = orderSessionsByLifecycleScopes(
      [parentWithSubagent, subagent, rootNewer],
      new Set(),
      rankById,
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'parent-with-subagent',
      'sub-agent',
      'root-newer',
    ]);
  });

  test('deep nesting: a grandchild with the newest activity bubbles its top-level root to the top', () => {
    const topRoot = session('top-root', 10);
    const child = session('child', 5, 'top-root');
    const grandchild = session('grandchild', 300, 'child');
    const otherRoot = session('other-root', 20);

    const ordered = orderSessionsByLifecycleScopes(
      [topRoot, child, grandchild, otherRoot],
      new Set(),
      new Map(),
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'top-root',
      'child',
      'grandchild',
      'other-root',
    ]);
  });

  test('children within a root keep their own sibling ordering, not the subtree max', () => {
    const root = session('root', 10);
    const childA = session('child-a', 30, 'root');
    const childB = session('child-b', 20, 'root');
    const childBSub = session('child-b-sub', 999, 'child-b');

    const ordered = orderSessionsByLifecycleScopes(
      [root, childA, childB, childBSub],
      new Set(),
      new Map(),
    );

    // Siblings sort by OWN activity: child-a (30) before child-b (20), even
    // though child-b's subtree is the newest (999) — same-parent comparisons
    // never use the subtree max.
    expect(ordered.map((item) => item.id)).toEqual([
      'root',
      'child-a',
      'child-b',
      'child-b-sub',
    ]);
  });

  test('pinned roots sort first; among pinned, order by effective subtree activity', () => {
    const pinnedA = sessionWithDirectory('pinned-a', 100, '/projects/a');
    const pinnedB = sessionWithDirectory('pinned-b', 50, '/projects/b');
    const pinnedBSub = sessionWithDirectory('pinned-b-sub', 400, '/projects/b', 'pinned-b');
    const unpinnedNewer = session('unpinned-newer', 500);

    const pinnedKeys = new Set([
      pinnedKeyFor('/projects/a', 'pinned-a'),
      pinnedKeyFor('/projects/b', 'pinned-b'),
    ]);

    const ordered = orderSessionsByLifecycleScopes(
      [pinnedA, pinnedB, pinnedBSub, unpinnedNewer],
      pinnedKeys,
      new Map(),
    );

    expect(ordered.map((item) => item.id)).toEqual([
      'pinned-b',
      'pinned-b-sub',
      'pinned-a',
      'unpinned-newer',
    ]);
  });

  test('with an effective map, root-to-root comparison uses subtree activity', () => {
    const rootWithSubagent = session('root-with-sub', 10);
    const subagent = session('sub-agent', 200, 'root-with-sub');
    const rootNewer = session('root-newer', 20);

    const effective = new Map([
      ['root-with-sub', 200],
      ['sub-agent', 200],
      ['root-newer', 20],
    ]);

    expect(compareSessionsByLifecycleOrder(
      rootWithSubagent,
      rootNewer,
      new Set(),
      new Map(),
      effective,
    )).toBeLessThan(0);
  });
});
