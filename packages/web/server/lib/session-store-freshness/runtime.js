import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// ── Session-store freshness ─────────────────────────────────────────────────
// A second OpenCode process (a CLI `run`, another server instance) writes the
// SAME session store this server serves, but its events live on that process's
// own bus — our upstream stream never sees them. This runtime watches the
// SQLite session store on disk, re-reads the session list through the served
// engine's own HTTP surface when the store moves, and announces the sessions
// whose content changed with a synthetic `openchamber:session-external-update`
// event. The event is a SIGNAL only (which session moved, when, in which
// directory) — browsers re-read from the server, so nothing here can go
// stale between send and handling.
//
// Loop guard: watermarks are a single monotonic map fed from BOTH the store
// diff and this server's own live events (its `session.updated` payloads).
// A value the browser already received from our own stream can therefore
// never be re-announced as external.

export const SESSION_STORE_FRESHNESS_EVENT_TYPE = 'openchamber:session-external-update';
export const DEFAULT_SESSION_STORE_DEBOUNCE_MS = 500;
export const DEFAULT_SESSION_STORE_POLL_INTERVAL_MS = 2000;

// SQLite main files and their WAL sidecars — the only store writes that can
// carry session changes. Host/version-tolerant: never a fixed file name.
const SESSION_STORE_FILE_PATTERN = /\.db(?:-(?:wal|shm))?$/;
// Comprehensive-list paging (mirrors the client sidebar loader): page size
// and a hard page cap so a pathological cursor can never spin the watcher.
const SESSION_PAGE_SIZE = 200;
const MAX_SESSION_PAGES = 10;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function resolveOpencodeStorageDir(env = process.env) {
  const xdgDataHome = (typeof env.XDG_DATA_HOME === 'string' && env.XDG_DATA_HOME.length > 0)
    ? env.XDG_DATA_HOME
    : path.join(os.homedir(), '.local', 'share');
  return path.join(xdgDataHome, 'opencode');
}

export function isSessionStoreFile(filename) {
  return typeof filename === 'string' && SESSION_STORE_FILE_PATTERN.test(filename);
}

/**
 * Parse unknown HTTP rows into trusted session records. Malformed rows are
 * dropped — a half-row must never poison a watermark.
 */
export function collectSessionRows(rawRows) {
  const rows = [];
  if (!Array.isArray(rawRows)) {
    return rows;
  }
  for (const raw of rawRows) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : '';
    const directory = typeof raw.directory === 'string' ? raw.directory : '';
    const updated = raw.time && isFiniteNumber(raw.time.updated) ? raw.time.updated : null;
    if (!id || !directory || updated === null) continue;
    rows.push({ id, updated, directory, archived: isFiniteNumber(raw.time.archived) });
  }
  return rows;
}

/**
 * Pure change detection. `previous` maps session id → { updated, directory,
 * archived }. First-sight sessions are SEEDED, never emitted (session
 * creation is out of scope here). Watermarks never move backwards; a value
 * equal to what is already known — including one seeded from our own live
 * events — produces no change. Newly archived rows are tracked, not emitted.
 */
export function diffSessionWatermarks(previous, rows) {
  const next = new Map(previous);
  const changes = [];

  for (const row of rows) {
    const known = next.get(row.id);
    if (!known) {
      next.set(row.id, { updated: row.updated, directory: row.directory, archived: row.archived });
      continue;
    }
    const merged = {
      updated: Math.max(known.updated, row.updated),
      directory: row.directory || known.directory,
      archived: row.archived,
    };
    next.set(row.id, merged);
    if (row.updated > known.updated && !row.archived) {
      changes.push({ sessionID: row.id, updated: row.updated, directory: merged.directory });
    }
  }

  return { next, changes };
}

const defaultFsShim = () => ({
  existsSync: (target) => fs.existsSync(target),
  readdirSync: (target) => fs.readdirSync(target),
  statSync: (target) => fs.statSync(target),
  watch: (target) => fs.watch(target),
});

export function createSessionStoreFreshnessRuntime(deps = {}) {
  const {
    getStorageDir = () => resolveOpencodeStorageDir(),
    fsImpl = defaultFsShim(),
    fetchImpl = (...args) => globalThis.fetch(...args),
    buildOpenCodeUrl,
    getOpenCodeAuthHeaders = () => ({}),
    globalEventHub = null,
    broadcastGlobalUiEvent,
    debounceMs = DEFAULT_SESSION_STORE_DEBOUNCE_MS,
    pollIntervalMs = DEFAULT_SESSION_STORE_POLL_INTERVAL_MS,
    setTimeoutImpl = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeoutImpl = (id) => globalThis.clearTimeout(id),
    setIntervalImpl = (fn, ms) => globalThis.setInterval(fn, ms),
    clearIntervalImpl = (id) => globalThis.clearInterval(id),
    logger = console,
  } = deps;

  const log = (level, ...args) => {
    try {
      logger?.[level]?.(...args);
    } catch {
      // logging must never break the signal path
    }
  };

  // session id → { updated, directory, archived }
  const watermarks = new Map();

  let startedFlag = false;
  let debounceTimer = null;
  let running = false;
  let rerunRequested = false;
  let everSucceeded = false;
  let baselineLogged = false;
  let watcher = null;
  let pollTimer = null;
  let lastPollFingerprint = null;
  let storageMissingWarned = false;
  let unsubscribeHub = null;

  // ── Loop guard input: our own stream's session lifecycle ──────────────
  const unwrapPayload = (event) => {
    if (!event || typeof event !== 'object') return null;
    const payload = event.payload && typeof event.payload === 'object' && event.payload.payload
      && typeof event.payload.payload === 'object' ? event.payload.payload : event.payload;
    return payload && typeof payload === 'object' ? payload : null;
  };

  const onHubEvent = (event) => {
    const payload = unwrapPayload(event);
    if (!payload || typeof payload.type !== 'string') return;

    if (payload.type === 'session.created' || payload.type === 'session.updated') {
      const info = payload.properties && typeof payload.properties === 'object' ? payload.properties.info : null;
      if (!info || typeof info !== 'object') return;
      const id = typeof info.id === 'string' && info.id.length > 0 ? info.id : '';
      if (!id) return;
      const known = watermarks.get(id);
      const rawTime = info.time && typeof info.time === 'object' ? info.time : null;
      const updated = rawTime && isFiniteNumber(rawTime.updated) ? rawTime.updated : (known ? known.updated : 0);
      watermarks.set(id, {
        updated: Math.max(known ? known.updated : 0, updated),
        directory: (typeof info.directory === 'string' && info.directory.length > 0)
          ? info.directory
          : (known ? known.directory : ''),
        archived: Boolean(rawTime && isFiniteNumber(rawTime.archived)),
      });
      return;
    }

    if (payload.type === 'session.deleted') {
      const sessionID = payload.properties && typeof payload.properties.sessionID === 'string'
        ? payload.properties.sessionID : '';
      if (sessionID) watermarks.delete(sessionID);
    }
  };

  // ── Store check through the served engine's own read path ─────────────
  // NOT plain `/session`: on a multi-project engine that route scopes to the
  // engine's default worktree and silently omits foreign projects (proved on
  // mmm1: 10 rows returned, the external session among 44 was invisible).
  // This is the same comprehensive read the app's own sidebar loader uses —
  // `experimental.session.list` (stores/globalSessions.ts): unscoped = all
  // projects, `archived=true` = inclusive so restored rows still diff, and
  // cursor semantics = "strictly before this updated timestamp" with the
  // `x-next-cursor` header preferred and the page's last `time.updated`
  // as fallback. Same stop guards as the client implementation.
  const fetchSessionRows = async () => {
    const headers = { ...getOpenCodeAuthHeaders() };
    const rows = [];
    const seen = new Set();
    let cursor;
    for (let page = 0; page < MAX_SESSION_PAGES; page += 1) {
      const params = new URLSearchParams({ archived: 'true', limit: String(SESSION_PAGE_SIZE) });
      if (cursor !== undefined) {
        params.set('cursor', String(cursor));
      }
      const url = buildOpenCodeUrl(`/experimental/session?${params.toString()}`, '');
      const response = await fetchImpl(url, { headers });
      if (!response || !response.ok) {
        throw new Error(`session list responded ${response ? response.status : 'unreachable'}`);
      }
      const body = await response.json();
      const payload = Array.isArray(body)
        ? body
        : body && Array.isArray(body.data) ? body.data : null;
      if (!payload) {
        throw new Error('session list was not an array');
      }
      let added = 0;
      for (const item of payload) {
        const id = item && typeof item.id === 'string' ? item.id : '';
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        rows.push(item);
        added += 1;
      }
      if (payload.length < SESSION_PAGE_SIZE) {
        break;
      }
      let headerCursor = Number.NaN;
      try {
        headerCursor = Number(response.headers && response.headers.get
          ? response.headers.get('x-next-cursor')
          : NaN);
      } catch {
        headerCursor = Number.NaN;
      }
      const lastUpdated = payload[payload.length - 1] && payload[payload.length - 1].time
        ? payload[payload.length - 1].time.updated
        : undefined;
      const nextCursor = isFiniteNumber(headerCursor)
        ? headerCursor
        : isFiniteNumber(lastUpdated) ? lastUpdated : undefined;
      if (nextCursor === undefined) {
        break;
      }
      if (cursor !== undefined && nextCursor >= cursor) {
        break;
      }
      if (added === 0) {
        break;
      }
      cursor = nextCursor;
    }
    return collectSessionRows(rows);
  };

  const runCheck = async () => {
    if (running) {
      rerunRequested = true;
      return;
    }
    running = true;
    try {
      const rows = await fetchSessionRows();
      const { next, changes } = diffSessionWatermarks(watermarks, rows);
      watermarks.clear();
      for (const [id, value] of next) {
        watermarks.set(id, value);
      }
      everSucceeded = true;
      if (!baselineLogged) {
        baselineLogged = true;
        log('log', `[session-store-freshness] baseline seeded: ${rows.length} session rows tracked`);
      }

      for (const change of changes) {
        broadcastGlobalUiEvent({
          type: SESSION_STORE_FRESHNESS_EVENT_TYPE,
          properties: {
            sessionID: change.sessionID,
            directory: change.directory,
            updated: change.updated,
            source: 'storage',
          },
        });
      }
      if (changes.length > 0) {
        log('log', `[session-store-freshness] announced ${changes.length} externally updated session(s)`);
      }
    } catch (error) {
      // Failure is not empty: watermarks are kept untouched and the next
      // signal (or the retry below) re-checks.
      log('warn', '[session-store-freshness] session-list check failed:', error && error.message ? error.message : error);
      if (!everSucceeded) {
        scheduleCheck(pollIntervalMs);
      }
    } finally {
      running = false;
      if (rerunRequested) {
        rerunRequested = false;
        scheduleCheck();
      }
    }
  };

  const scheduleCheck = (delayMs = debounceMs) => {
    if (debounceTimer) return;
    debounceTimer = setTimeoutImpl(() => {
      debounceTimer = null;
      void runCheck();
    }, delayMs);
  };

  // ── Watcher, with a stat-poll fallback ────────────────────────────────
  const listStoreFiles = () => {
    try {
      return fsImpl.readdirSync(getStorageDir()).filter(isSessionStoreFile);
    } catch {
      return [];
    }
  };

  const pollFingerprint = () => {
    let newest = 0;
    let totalSize = 0;
    for (const name of listStoreFiles()) {
      try {
        const stat = fsImpl.statSync(path.join(getStorageDir(), name));
        newest = Math.max(newest, stat.mtimeMs || 0);
        totalSize += stat.size || 0;
      } catch {
        // file rotated away mid-stat — next tick will see the new layout
      }
    }
    return `${newest}:${totalSize}`;
  };

  const pollTick = () => {
    try {
      if (!fsImpl.existsSync(getStorageDir())) {
        lastPollFingerprint = null;
        return;
      }
    } catch {
      return;
    }
    const fingerprint = lastStoreAvailableFingerprint();
    if (fingerprint === null) return;
    if (lastPollFingerprint === null) {
      lastPollFingerprint = fingerprint;
      return;
    }
    if (fingerprint !== lastPollFingerprint) {
      lastPollFingerprint = fingerprint;
      scheduleCheck();
    }
  };

  const lastStoreAvailableFingerprint = () => {
    try {
      return pollFingerprint();
    } catch {
      return null;
    }
  };

  const startPollFallback = () => {
    if (pollTimer !== null) return;
    pollTimer = setIntervalImpl(pollTick, pollIntervalMs);
  };

  const stopPollFallback = () => {
    if (pollTimer === null) return;
    clearIntervalImpl(pollTimer);
    pollTimer = null;
  };

  const closeWatcher = () => {
    if (!watcher) return;
    try {
      watcher.close();
    } catch {
      // already closed
    }
    watcher = null;
  };

  const startWatching = () => {
    const dir = getStorageDir();
    try {
      if (!fsImpl.existsSync(dir)) {
        if (!storageMissingWarned) {
          storageMissingWarned = true;
          log('warn', `[session-store-freshness] storage dir not present yet (${dir}); polling for it`);
        }
        startPollFallback();
        return;
      }
      storageMissingWarned = false;
      try {
        watcher = fsImpl.watch(dir);
      } catch {
        watcher = null;
        startPollFallback();
        return;
      }
      if (watcher && typeof watcher.on === 'function') {
        watcher.on('change', (eventType, filename) => {
          // No filename (some platforms) → can't filter; treat as a store signal.
          if (typeof filename !== 'string' || isSessionStoreFile(filename)) {
            scheduleCheck();
          }
        });
        watcher.on('error', () => {
          closeWatcher();
          startPollFallback();
        });
      } else {
        startPollFallback();
      }
    } catch {
      startPollFallback();
    }
  };

  const start = () => {
    if (startedFlag) return;
    startedFlag = true;
    log('log', '[session-store-freshness] started (storage watch + baseline check active)');

    if (globalEventHub && typeof globalEventHub.subscribeEvent === 'function') {
      unsubscribeHub = globalEventHub.subscribeEvent(onHubEvent);
    }

    // Quiet baseline so the first real signal has something to compare
    // against (first-sight semantics alone would miss a pre-existing
    // session's first external update).
    scheduleCheck();

    startWatching();
  };

  const stop = () => {
    startedFlag = false;
    if (debounceTimer) {
      clearTimeoutImpl(debounceTimer);
      debounceTimer = null;
    }
    rerunRequested = false;
    stopPollFallback();
    closeWatcher();
    if (unsubscribeHub) {
      try {
        unsubscribeHub();
      } catch {
        // already gone
      }
      unsubscribeHub = null;
    }
  };

  return { start, stop };
}
