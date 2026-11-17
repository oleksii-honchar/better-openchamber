import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSessionStoreFreshnessRuntime,
  diffSessionWatermarks,
  isSessionStoreFile,
  collectSessionRows,
  SESSION_STORE_FRESHNESS_EVENT_TYPE,
} from './runtime.js';

function aRow(id, updated, directory = '/repo/one', extra = {}) {
  return {
    id,
    directory,
    title: `session ${id}`,
    time: { created: updated - 1000, updated, ...extra },
    ...('archived' in extra ? {} : {}),
  };
}

function createFakeWatcher() {
  const handlers = {};
  return {
    handlers,
    emit(event, ...args) {
      handlers[event]?.(...args);
    },
    on(event, cb) {
      handlers[event] = cb;
    },
    close() {
      this.closed = true;
    },
  };
}

function createTestDeps({ rows = [], watchImpl, fsExtra = {}, hubEventsToDeliver = false } = {}) {
  const watcher = createFakeWatcher();
  const fetchCalls = [];
  const listQueue = [];
  const emitted = [];
  const hubSubscribers = [];

  const deps = {
    getStorageDir: () => '/tmp/fake-opencode-store',
    fsImpl: {
      existsSync: () => true,
      readdirSync: () => ['opencode-patched-dev2.db', 'opencode-patched-dev2.db-wal', 'notes.txt'],
      statSync: () => ({ mtimeMs: 1, size: 10 }),
      watch: () => watchImpl ?? watcher,
      ...fsExtra,
    },
    buildOpenCodeUrl: (pathname) => `http://127.0.0.1:61777${pathname}`,
    getOpenCodeAuthHeaders: () => ({ authorization: 'Basic test' }),
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      const override = listQueue.shift();
      if (override instanceof Error) {
        throw override;
      }
      const body = override ?? rows;
      return { ok: true, status: 200, json: async () => body };
    },
    globalEventHub: {
      subscribeEvent(cb) {
        hubSubscribers.push(cb);
        return () => {
          const index = hubSubscribers.indexOf(cb);
          if (index >= 0) hubSubscribers.splice(index, 1);
        };
      },
      publish(payload) {
        for (const cb of [...hubSubscribers]) {
          cb({ payload, directory: 'global' });
        }
      },
    },
    broadcastGlobalUiEvent: (payload) => {
      emitted.push(payload);
    },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  };

  return { deps, watcher, fetchCalls, emitted, listQueue, hub: deps.globalEventHub };
}

async function settle() {
  await vi.advanceTimersByTimeAsync(600);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isSessionStoreFile', () => {
  it('matches sqlite stores and wal sidecars, ignores other files', () => {
    expect(isSessionStoreFile('opencode.db')).toBe(true);
    expect(isSessionStoreFile('opencode-patched-dev2.db')).toBe(true);
    expect(isSessionStoreFile('opencode-patched-dev2.db-wal')).toBe(true);
    expect(isSessionStoreFile('opencode-patched-dev2.db-shm')).toBe(true);
    expect(isSessionStoreFile('notes.txt')).toBe(false);
    expect(isSessionStoreFile('auth.json')).toBe(false);
  });
});

describe('collectSessionRows', () => {
  it('keeps well-formed rows and skips malformed ones', () => {
    const rows = collectSessionRows([
      aRow('s1', 100),
      { id: 'bad-no-time' },
      { id: 'bad-no-dir', time: { updated: 5 } },
      { id: 42, time: { updated: 5 }, directory: '/x' },
      null,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 's1', updated: 100, directory: '/repo/one', archived: false });
  });

  it('marks archived rows', () => {
    const rows = collectSessionRows([aRow('s1', 100, '/x', { archived: 999 })]);
    expect(rows[0].archived).toBe(true);
  });
});

describe('diffSessionWatermarks (pure change detection + loop guard)', () => {
  const toMap = (entries) => new Map(entries);

  it('treats first sight as silent seed', () => {
    const { changes, next } = diffSessionWatermarks(toMap([]), [
      { id: 's1', updated: 100, directory: '/x', archived: false },
    ]);
    expect(changes).toEqual([]);
    expect(next.get('s1')).toMatchObject({ updated: 100 });
  });

  it('emits a change only for a strictly newer known session', () => {
    const previous = toMap([['s1', { updated: 100, directory: '/x', archived: false }]]);
    const { changes, next } = diffSessionWatermarks(previous, [
      { id: 's1', updated: 101, directory: '/x', archived: false },
      { id: 's2', updated: 50, directory: '/y', archived: false },
    ]);
    expect(changes).toEqual([{ sessionID: 's1', updated: 101, directory: '/x' }]);
    expect(next.get('s2').updated).toBe(50);
  });

  it('is idempotent for repeated values and never moves backwards', () => {
    const previous = toMap([['s1', { updated: 100, directory: '/x', archived: false }]]);
    const same = diffSessionWatermarks(previous, [{ id: 's1', updated: 100, directory: '/x', archived: false }]);
    expect(same.changes).toEqual([]);
    expect(same.next.get('s1').updated).toBe(100);

    const older = diffSessionWatermarks(previous, [{ id: 's1', updated: 42, directory: '/x', archived: false }]);
    expect(older.changes).toEqual([]);
    expect(older.next.get('s1').updated).toBe(100);
  });

  it('suppressed values (equal to a self-fed watermark) produce no event — loop guard', () => {
    const previous = toMap([['s1', { updated: 100, directory: '/x', archived: false }]]);
    const { changes, next } = diffSessionWatermarks(previous, [
      { id: 's1', updated: 100, directory: '/x', archived: false },
    ]);
    expect(changes).toHaveLength(0);
    expect(next.get('s1').updated).toBe(100);
  });

  it('does not emit for newly archived rows but tracks them', () => {
    const previous = toMap([['s1', { updated: 100, directory: '/x', archived: false }]]);
    const { changes, next } = diffSessionWatermarks(previous, [
      { id: 's1', updated: 101, directory: '/x', archived: true },
    ]);
    expect(changes).toEqual([]);
    expect(next.get('s1').archived).toBe(true);
  });
});

describe('createSessionStoreFreshnessRuntime', () => {
  it('baselines on start, then emits once for an externally-bumped known session', async () => {
    const base = createTestDeps({ rows: [aRow('s1', 100)] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();

    // Baseline pass runs via the debounce — seeds, must not emit.
    await settle();
    expect(base.fetchCalls).toHaveLength(1);
    expect(base.emitted).toEqual([]);

    // Store signal from any session-store file triggers exactly one check.
    base.listQueue.push([aRow('s1', 105)]);
    base.watcher.emit('change', 'change', 'opencode-patched-dev2.db-wal');
    await settle();
    expect(base.fetchCalls).toHaveLength(2);
    expect(base.emitted).toHaveLength(1);
    expect(base.emitted[0]).toEqual({
      type: SESSION_STORE_FRESHNESS_EVENT_TYPE,
      properties: { sessionID: 's1', directory: '/repo/one', updated: 105, source: 'storage' },
    });

    // Re-checking the same value stays quiet.
    base.listQueue.push([aRow('s1', 105)]);
    base.watcher.emit('change', 'change', 'opencode-patched-dev2.db');
    await settle();
    expect(base.emitted).toHaveLength(1);

    runtime.stop();
  });

  it('ignores signals for unrelated files and coalesces bursts into one check', async () => {
    const base = createTestDeps({ rows: [aRow('s1', 100)] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();
    expect(base.fetchCalls).toHaveLength(1);

    base.watcher.emit('change', 'change', 'auth.json');
    base.watcher.emit('change', 'change', 'storage/tmp-write.lock');
    await settle();
    expect(base.fetchCalls).toHaveLength(1);

    base.listQueue.push([aRow('s1', 110)]);
    base.watcher.emit('change', 'change', 'opencode.db');
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    base.watcher.emit('change', 'change', 'opencode.db-shm');
    await settle();
    expect(base.fetchCalls).toHaveLength(2);
    expect(base.emitted).toHaveLength(1);

    runtime.stop();
  });

  it('never emits for sessions first seen after the baseline (creation is out of scope)', async () => {
    const base = createTestDeps({ rows: [] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();

    // A new session (e.g. created by another process) appears — seeded, no event.
    base.listQueue.push([aRow('s2', 10)]);
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toEqual([]);

    // A later external update of it is a content change — emits.
    base.listQueue.push([aRow('s2', 11)]);
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toHaveLength(1);
    expect(base.emitted[0].properties.sessionID).toBe('s2');

    runtime.stop();
  });

  it('loop guard: own hub session.updated seeds the watermark so the store diff stays silent', async () => {
    const base = createTestDeps({ rows: [] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();

    base.hub.publish({ type: 'session.updated', properties: { info: { id: 's1', directory: '/repo/one', time: { updated: 500 } } } });

    base.listQueue.push([aRow('s1', 500)]);
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toEqual([]);

    // A genuinely newer external value still passes.
    base.listQueue.push([aRow('s1', 501)]);
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toHaveLength(1);

    runtime.stop();
  });

  it('loop guard: own session.created seeds first-sight and never emits; session.idle is ignored', async () => {
    const base = createTestDeps({ rows: [] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();

    base.hub.publish({ type: 'session.created', properties: { info: { id: 'mine', directory: '/repo/one', time: { created: 10, updated: 10 } } } });
    base.hub.publish({ type: 'session.idle', properties: { sessionID: 'other' } });

    base.listQueue.push([aRow('mine', 10)]);
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toEqual([]);

    runtime.stop();
  });

  it('fetch failure is not empty: keeps watermarks and retries on the next signal', async () => {
    const base = createTestDeps({ rows: [aRow('s1', 100)] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();

    base.listQueue.push(new Error('ECONNREFUSED'));
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toEqual([]);

    base.listQueue.push([aRow('s1', 130)]);
    base.watcher.emit('change', 'change', 'opencode.db-wal');
    await settle();
    expect(base.emitted).toHaveLength(1);
    expect(base.emitted[0].properties.updated).toBe(130);

    runtime.stop();
  });

  it('degrades to a stat-poll when fs.watch is unavailable', async () => {
    let pollTick;
    let statMode = 'low';
    const base = createTestDeps({
      rows: [aRow('s1', 100)],
      fsExtra: {
        // watch() throws synchronously → fallback interval path.
        watch: () => { throw new Error('EMFILE'); },
        statSync: () => (statMode === 'high' ? { mtimeMs: 999, size: 50 } : { mtimeMs: 1, size: 1 }),
      },
    });
    base.deps.setIntervalImpl = (fn) => { pollTick = fn; return 1; };
    base.deps.clearIntervalImpl = () => { pollTick = undefined; };

    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();
    expect(base.fetchCalls).toHaveLength(1); // baseline still ran via the start path

    expect(typeof pollTick).toBe('function');
    // A store mtime bump seen only by the poll still reaches the signal path.
    statMode = 'low';
    pollTick(); // low baseline
    statMode = 'high';
    pollTick(); // changed fingerprint → signal
    await settle();
    expect(base.fetchCalls).toHaveLength(2);

    runtime.stop();
  });

  it('stop() unsubscribes the hub and closes the watcher', async () => {
    const base = createTestDeps({ rows: [] });
    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();

    runtime.stop();
    runtime.stop();

    expect(base.watcher.closed).toBe(true);
    base.hub.publish({ type: 'session.updated', properties: { info: { id: 'after-stop', directory: '/x', time: { updated: 1 } } } });
    base.listQueue.push([aRow('after-stop', 2)]);
    await settle();
    // The debounced path is no longer armed; nothing schedules.
    expect(base.fetchCalls).toHaveLength(1);
  });

  it('missing storage dir never throws; the poll re-checks dir creation', async () => {
    let dirExists = false;
    const base = createTestDeps({
      rows: [],
      fsExtra: {
        existsSync: () => dirExists,
        watch: () => { throw new Error('should not watch while dir is missing'); },
      },
    });
    base.deps.setIntervalImpl = (fn) => { base.deps.__poll = fn; return 77; };
    base.deps.clearIntervalImpl = () => { base.deps.__poll = undefined; };

    const runtime = createSessionStoreFreshnessRuntime(base.deps);
    runtime.start();
    await settle();

    // Engine store appears; poll pass notices the dir (fetch may fail while
    // the engine is cold — errors are swallowed and retried).
    dirExists = true;
    expect(() => base.deps.__poll()).not.toThrow();
    await settle();

    runtime.stop();
  });
});
