import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { getSafeStorage } from '@/stores/utils/safeStorage';
import { applyGlobalSessionStatusSnapshot } from './global-session-status';
import {
  observeSessionActivityTiming,
  reconcileSessionActivityTiming,
  removeSessionActivityTiming,
  resetSessionActivityTiming,
  useSessionActivityTimingStore,
} from './session-activity-timing';

const STORAGE_KEY = 'oc.session-activity.v1';

const startedAt = (sessionId: string): number | undefined =>
  useSessionActivityTimingStore.getState().startedAt.get(sessionId);

const settledMs = (sessionId: string): number | undefined =>
  useSessionActivityTimingStore.getState().settledMs.get(sessionId);

type PersistedStart = { start: number; seen: number };

const readPersisted = (): Record<string, PersistedStart> | null => {
  const raw = getSafeStorage().getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, PersistedStart>) : null;
};

/**
 * Seed a previous page session's record, then simulate the reload.
 * `loadedAgoMs` places this page's navigation start in the past, which is how a
 * slow bootstrap or an expired adoption window is expressed.
 */
const seedReload = (payload: unknown, loadedAgoMs = 0): void => {
  getSafeStorage().setItem(STORAGE_KEY, JSON.stringify(payload));
  resetSessionActivityTiming({ pageLoadAt: Date.now() - loadedAgoMs });
};

/** A status snapshot: which sessions it reports busy, and which it covers. */
const snapshot = (activeIds: string[], coveredIds: string[] = activeIds): void => {
  const covered = new Set(coveredIds);
  reconcileSessionActivityTiming(new Set(activeIds), (sessionId) => covered.has(sessionId));
};

/** A record for a turn that began `ageMs` ago and was alive until the reload. */
const runningUntilReload = (ageMs: number, loadedAgoMs = 0, quietFor = 1_000): PersistedStart => ({
  start: Date.now() - ageMs,
  seen: Date.now() - loadedAgoMs - quietFor,
});

beforeEach(() => {
  getSafeStorage().removeItem(STORAGE_KEY);
  resetSessionActivityTiming();
});

afterEach(() => {
  getSafeStorage().removeItem(STORAGE_KEY);
  resetSessionActivityTiming();
});

describe('session activity timing', () => {
  test('starts a turn on the first active observation and keeps it stable', () => {
    observeSessionActivityTiming('ses_a', 'active');
    const first = startedAt('ses_a');
    expect(first).toBeGreaterThan(0);

    // Repeated busy/retry status events must not restart the counter.
    observeSessionActivityTiming('ses_a', 'active');
    expect(startedAt('ses_a')).toBe(first);
  });

  test('settling converts the start into a duration', () => {
    observeSessionActivityTiming('ses_a', 'active');
    observeSessionActivityTiming('ses_a', 'settled');

    expect(startedAt('ses_a')).toBe(undefined);
    expect(settledMs('ses_a')).toBeGreaterThanOrEqual(0);
  });

  test('a new turn clears the previous settled duration', () => {
    observeSessionActivityTiming('ses_a', 'active');
    observeSessionActivityTiming('ses_a', 'settled');
    expect(settledMs('ses_a')).toBeDefined();

    observeSessionActivityTiming('ses_a', 'active');
    expect(settledMs('ses_a')).toBe(undefined);
    expect(startedAt('ses_a')).toBeDefined();
  });

  test('settling a session that was never observed active yields no duration', () => {
    observeSessionActivityTiming('ses_a', 'settled');

    expect(startedAt('ses_a')).toBe(undefined);
    expect(settledMs('ses_a')).toBe(undefined);
  });

  test('snapshot reconciliation starts covered actives and settles the rest', () => {
    observeSessionActivityTiming('ses_a', 'active');
    observeSessionActivityTiming('ses_b', 'active');

    snapshot(['ses_a'], ['ses_a', 'ses_b', 'ses_c']);

    expect(startedAt('ses_a')).toBeDefined();
    expect(startedAt('ses_b')).toBe(undefined);
    expect(settledMs('ses_b')).toBeGreaterThanOrEqual(0);
    // Never active, never covered by a start: nothing to report.
    expect(settledMs('ses_c')).toBe(undefined);
  });

  test('a session outside the snapshot scope keeps running', () => {
    observeSessionActivityTiming('ses_other_directory', 'active');
    const start = startedAt('ses_other_directory');

    snapshot([], ['ses_a']);

    expect(startedAt('ses_other_directory')).toBe(start);
  });

  test('persists the start and a liveness stamp for a running turn', () => {
    observeSessionActivityTiming('ses_a', 'active');

    const persisted = readPersisted();
    expect(persisted?.ses_a.start).toBe(startedAt('ses_a') as number);
    expect(persisted?.ses_a.seen).toBeGreaterThanOrEqual(persisted?.ses_a.start as number);
  });

  test('clears the persisted record when the turn ends', () => {
    observeSessionActivityTiming('ses_a', 'active');
    observeSessionActivityTiming('ses_a', 'settled');

    expect(readPersisted()).toBeNull();
  });

  test('resumes a persisted start when a status snapshot reports the session active', () => {
    const record = runningUntilReload(90_000);
    seedReload({ ses_a: record });

    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBe(record.start);
  });

  // Regression: the server re-publishes `session.status: busy` at every step of
  // the agent loop, so after a reload one of those repeats normally arrives
  // before the first status snapshot. Reading a busy event as "a turn just
  // started" therefore reset the counter on almost every refresh.
  test('resumes when a repeated busy event arrives before the first snapshot', () => {
    const record = runningUntilReload(90_000);
    seedReload({ ses_a: record });

    observeSessionActivityTiming('ses_a', 'active');

    expect(startedAt('ses_a')).toBe(record.start);
  });

  test('the turn after a resumed one still counts from zero', () => {
    const record = runningUntilReload(90_000);
    seedReload({ ses_a: record });

    // Reload lands mid-turn: the snapshot resumes it…
    snapshot(['ses_a'], ['ses_a']);
    expect(startedAt('ses_a')).toBe(record.start);

    // …it finishes, which retires the record, so the next turn starts fresh.
    observeSessionActivityTiming('ses_a', 'settled');
    const before = Date.now();
    observeSessionActivityTiming('ses_a', 'active');

    expect(startedAt('ses_a')).toBeGreaterThanOrEqual(before);
  });

  test('a live idle event retires the persisted record', () => {
    const record = runningUntilReload(90_000);
    seedReload({ ses_a: record });

    // The turn ended while the tab was gone; the event arrives on reconnect.
    observeSessionActivityTiming('ses_a', 'settled');
    // A later snapshot must not resurrect the retired start.
    const before = Date.now();
    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBeGreaterThanOrEqual(before);
  });

  // The absence is measured from navigation start, not from "now", so a slow
  // bootstrap on a slow machine cannot spend the whole allowance before the
  // first status snapshot arrives.
  test('resumes even when bootstrap takes most of a minute', () => {
    const loadedAgoMs = 45_000;
    const record = runningUntilReload(300_000, loadedAgoMs);
    seedReload({ ses_a: record }, loadedAgoMs);

    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBe(record.start);
  });

  test('does not adopt a record once the adoption window has passed', () => {
    const loadedAgoMs = 5 * 60_000;
    const record = runningUntilReload(300_000, loadedAgoMs);
    seedReload({ ses_a: record }, loadedAgoMs);

    // A turn starting this long after load is a new turn, not the one that was
    // running before the reload.
    const before = Date.now();
    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBeGreaterThanOrEqual(before);
  });

  // Regression: bootstrap fetches status and sessions in parallel, so a
  // snapshot can legitimately cover a session before it can see it busy.
  // Treating that as "the turn ended" used to destroy the persisted start
  // moments before the real busy snapshot arrived, resetting the counter to 0s.
  test('an early snapshot that cannot see the session busy does not lose the start', () => {
    const record = runningUntilReload(120_000);
    seedReload({ ses_a: record });

    applyGlobalSessionStatusSnapshot('/repo', {}, ['ses_a']);
    applyGlobalSessionStatusSnapshot('/repo', { ses_a: { type: 'busy' } }, ['ses_a']);

    expect(startedAt('ses_a')).toBe(record.start);
  });

  test('resumes through a snapshot that arrives before the session list loads', () => {
    const record = runningUntilReload(120_000);
    seedReload({ ses_a: record });

    applyGlobalSessionStatusSnapshot('/repo', { ses_a: { type: 'busy' } }, []);

    expect(startedAt('ses_a')).toBe(record.start);
  });

  test('does not resume a record whose liveness stamp has gone quiet', () => {
    const before = Date.now();
    seedReload({ ses_a: { start: before - 300_000, seen: before - 240_000 } });

    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBeGreaterThanOrEqual(before);
  });

  test('does not resume a turn older than the maximum turn age', () => {
    const before = Date.now();
    seedReload({ ses_a: { start: before - 48 * 60 * 60 * 1000, seen: before - 1_000 } });

    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBeGreaterThanOrEqual(before);
  });

  test('ignores malformed persisted payloads', () => {
    getSafeStorage().setItem(STORAGE_KEY, 'not json');
    resetSessionActivityTiming();

    const before = Date.now();
    snapshot(['ses_a'], ['ses_a']);

    expect(startedAt('ses_a')).toBeGreaterThanOrEqual(before);
  });

  test('ignores entries of the wrong shape or dated in the future', () => {
    const before = Date.now();
    seedReload({
      ses_a: before - 5_000,
      ses_b: { start: 'nope', seen: before },
      ses_c: { start: before + 60_000, seen: before },
      ses_d: { start: before - 5_000, seen: before + 60_000 },
    });

    for (const sessionId of ['ses_a', 'ses_b', 'ses_c', 'ses_d']) {
      snapshot([sessionId]);
      expect(startedAt(sessionId)).toBeGreaterThanOrEqual(before);
    }
  });

  test('a quiet record ages out of storage on the next write', () => {
    const before = Date.now();
    seedReload({ ses_quiet: { start: before - 300_000, seen: before - 240_000 } });

    observeSessionActivityTiming('ses_a', 'active');

    expect(readPersisted()?.ses_quiet).toBe(undefined);
    expect(readPersisted()?.ses_a.start).toBeDefined();
  });

  test('deleting a session clears live, settled, and persisted timing', () => {
    observeSessionActivityTiming('ses_a', 'active');
    observeSessionActivityTiming('ses_b', 'active');
    observeSessionActivityTiming('ses_b', 'settled');

    removeSessionActivityTiming('ses_a');
    removeSessionActivityTiming('ses_b');

    expect(startedAt('ses_a')).toBe(undefined);
    expect(settledMs('ses_b')).toBe(undefined);
    expect(readPersisted()).toBeNull();
  });

  test('unrelated sessions keep their map references across a no-op update', () => {
    observeSessionActivityTiming('ses_a', 'active');
    const before = useSessionActivityTimingStore.getState();

    observeSessionActivityTiming('ses_a', 'active');
    observeSessionActivityTiming('ses_unknown', 'settled');

    const after = useSessionActivityTimingStore.getState();
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.settledMs).toBe(before.settledMs);
  });
});

// ---------------------------------------------------------------------------
// Running-only duration read (ADR-19 P2 / design-elapsed-counter §6 fixture).
//
// The read exists WHILE AND ONLY WHILE the current turn is running, and only
// when the turn's start was actually observed. A busy state first seen through
// a status snapshot (the client joined mid-turn) mints no known start: the
// read stays empty rather than reporting a zero measured from the observation.
// The module keeps no clock, so the pin below is against the start anchor and
// its provenance gate — what the leaf components subtract their ticker from.
// The fixture is the design record's 47 s gated turn: prompt at t0, first
// busy at t0.3, busy re-published at t50 / t55 / t60, idle at t62.
// ---------------------------------------------------------------------------
describe('running-only duration read', () => {
  // A fixture clock: the real epoch captured at test start, then moved only
  // in place. The module and this file's helpers all read Date.now(), so the
  // whole fixture travels on one clock; the file-level reset hooks and
  // pageLoadAt capture stay on the real clock, adjacent to the fixture's t0
  // because every `at()` offset stays small.
  const realNow = Date.now.bind(Date);
  let t0 = 0;
  let nowMs = 0;
  const at = (ms: number): void => {
    nowMs = t0 + ms;
  };

  const state = () => useSessionActivityTimingStore.getState();
  const startOf = (sessionId: string): number | undefined => state().startedAt.get(sessionId);
  // The start the running-only read exposes, as its value hook selects it:
  // the recorded start only while its provenance is known.
  const runningStartOf = (sessionId: string): number | undefined => (
    state().unknownStarts.has(sessionId) ? undefined : state().startedAt.get(sessionId)
  );
  const hasRunningDuration = (sessionId: string): boolean => (
    state().startedAt.has(sessionId) && !state().unknownStarts.has(sessionId)
  );
  const elapsedOf = (sessionId: string): number => nowMs - (runningStartOf(sessionId) as number);

  beforeEach(() => {
    t0 = realNow();
    nowMs = t0;
    Date.now = () => nowMs;
  });

  afterEach(() => {
    Date.now = realNow;
    getSafeStorage().removeItem(STORAGE_KEY);
    resetSessionActivityTiming();
  });

  test('stamps the turn start on the first busy observation and holds it through the run', () => {
    at(300);
    observeSessionActivityTiming('ses_a', 'active');

    expect(startOf('ses_a')).toBe(t0 + 300);
    expect(runningStartOf('ses_a')).toBe(t0 + 300);
    expect(hasRunningDuration('ses_a')).toBe(true);

    // Mid-turn (fixture t30): elapsed continues from the original stamp.
    at(30_300);
    expect(elapsedOf('ses_a')).toBe(30_000);
  });

  test('re-published busy never re-stamps: elapsed continues 49.7 s / 54.7 s / 59.7 s from the original start', () => {
    at(300);
    observeSessionActivityTiming('ses_a', 'active');

    for (const republishAtMs of [50_000, 55_000, 60_000]) {
      at(republishAtMs);
      observeSessionActivityTiming('ses_a', 'active');
      expect(startOf('ses_a')).toBe(t0 + 300);
      expect(elapsedOf('ses_a')).toBe(republishAtMs - 300);
      expect(hasRunningDuration('ses_a')).toBe(true);
      expect(settledMs('ses_a')).toBe(undefined);
    }
  });

  test('a turn joined through a snapshot has an unknown start: the read stays empty, never zero', () => {
    // Client joined mid-turn at fixture t30; the first thing it sees is a
    // snapshot reporting the session busy. The sidebar's counter keeps its
    // observed-from semantics (start present) — the running read must not
    // borrow that timestamp as if the turn's start had been watched.
    at(30_000);
    snapshot(['ses_a'], ['ses_a']);

    expect(startOf('ses_a')).toBeDefined();
    expect(state().unknownStarts.has('ses_a')).toBe(true);
    expect(runningStartOf('ses_a')).toBe(undefined);
    expect(hasRunningDuration('ses_a')).toBe(false);

    // A busy event re-published later in the same turn neither re-stamps nor
    // resolves the provenance: the true start is still unobserved.
    at(50_000);
    observeSessionActivityTiming('ses_a', 'active');
    expect(startOf('ses_a')).toBe(t0 + 30_000);
    expect(runningStartOf('ses_a')).toBe(undefined);
    expect(hasRunningDuration('ses_a')).toBe(false);

    // And the turn ending clears everything, gate included.
    at(62_000);
    observeSessionActivityTiming('ses_a', 'settled');
    expect(startOf('ses_a')).toBe(undefined);
    expect(state().unknownStarts.has('ses_a')).toBe(false);
    expect(hasRunningDuration('ses_a')).toBe(false);
  });

  // The caller maps both `session.idle` and `session.error` to this module's
  // single 'settled' phase (global-session-status.ts), so the one-shot edge
  // is pinned at this boundary; two consecutive turns prove the clear is not
  // one-shot by accident of the first end.
  test('settling clears the read immediately, and the next turn starts fresh and known', () => {
    at(300);
    observeSessionActivityTiming('ses_a', 'active');
    at(62_000);
    observeSessionActivityTiming('ses_a', 'settled');

    expect(startOf('ses_a')).toBe(undefined);
    expect(runningStartOf('ses_a')).toBe(undefined);
    expect(hasRunningDuration('ses_a')).toBe(false);

    at(70_000);
    observeSessionActivityTiming('ses_a', 'active');
    expect(runningStartOf('ses_a')).toBe(t0 + 70_000);
    expect(hasRunningDuration('ses_a')).toBe(true);

    at(80_000);
    observeSessionActivityTiming('ses_a', 'settled'); // e.g. session.error
    expect(runningStartOf('ses_a')).toBe(undefined);
    expect(hasRunningDuration('ses_a')).toBe(false);
  });

  test('a start adopted from a persisted record is known: a reload resumes the count', () => {
    // The distinction from joining mid-turn: this page observed the turn's
    // beginning before the reload and persisted it. The record is the same
    // fact the sidebar's resume relies on, so the running read keeps it.
    at(90_000);
    seedReload({ ses_a: runningUntilReload(60_000) });

    snapshot(['ses_a'], ['ses_a']);

    expect(startOf('ses_a')).toBe(t0 + 30_000);
    expect(state().unknownStarts.has('ses_a')).toBe(false);
    expect(hasRunningDuration('ses_a')).toBe(true);
    expect(elapsedOf('ses_a')).toBe(60_000);
  });
});
