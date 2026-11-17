# Session-Store Freshness — Module Documentation

## Purpose

Makes writes made by OTHER OpenCode processes into the shared session store
visible to this app's live UI. A second `better-opencode` process (a CLI
`run`, a second server instance) writes the same SQLite session store the
served engine reads, but its events stay on that process's own bus — the
upstream stream this app consumes is blind to them. Without a signal here,
foreign activity only appears after a manual reload (the reload re-fetches
over HTTP, which does read the shared storage).

## Entrypoints and structure

- `packages/web/server/lib/session-store-freshness/runtime.js`: the watcher
  runtime, the pure diff helpers, and the storage-dir resolver.
- `packages/web/server/lib/session-store-freshness/runtime.test.js`: unit
  tests for the full signal loop and the pure change-detection/loop-guard.

## Public exports

- `createSessionStoreFreshnessRuntime(deps)`: creates the watcher runtime.
  Deps (all injectable for tests): `getStorageDir`, `fsImpl`, `fetchImpl`,
  `buildOpenCodeUrl`, `getOpenCodeAuthHeaders`, `globalEventHub`,
  `broadcastGlobalUiEvent`, `debounceMs` (default 500),
  `pollIntervalMs` (default 2000), timer impls, `logger`.
  Returns `{ start, stop }`.
- `SESSION_STORE_FRESHNESS_EVENT_TYPE`: `openchamber:session-external-update`.
- `resolveOpencodeStorageDir(env)`: `(XDG_DATA_HOME || ~/.local/share)/opencode`
  (same resolution the Git worktree module already uses).
- `isSessionStoreFile(filename)`: `.db` / `.db-wal` / `.db-shm` matcher —
  host/version-tolerant, never a fixed file name.
- `collectSessionRows(rawRows)`: parse/validate unknown HTTP rows; malformed
  rows drop.
- `diffSessionWatermarks(previousMap, rows)`: pure. Returns
  `{ next, changes }` — see semantics below.

## Runtime behavior

- The store DIRECTORY is watched (non-recursive). Only changes to
  `*.db*` / `*.db-wal` / `*.db-shm` files count; the WAL sidecar is the
  reliable commit signal in WAL mode, so it is included by pattern, not by
  hard-coded name.
- Signals are coalesced through one trailing debounce (500 ms; store writes
  are bursty). A check already in flight re-runs once after finishing if
  new signals arrived meanwhile.
- A check reads the session list through the served engine's own HTTP read
  path (`GET /session` via `buildOpenCodeUrl` + auth headers) — the same
  path a page reload uses, so foreign writes ARE observable. No direct
  SQLite access (no WAL/schema/dependency coupling). Because the list comes
  from the served engine, only this deployment's sessions are ever
  considered (multi-DB/host safety is inherent, not a filter).
- `openchamber:session-external-update` is emitted per session whose list
  `time.updated` became STRICTLY newer than the known watermark, with
  `{ sessionID, directory, updated, source: "storage" }`. It is a SIGNAL
  only — like `openchamber:agent-memory-changed`, listeners re-read from
  the server. The event is NOT a `session.updated` impersonation: the real
  one must carry a full `properties.info` and only merges it, and would
  silently re-publish a stale/partial info; this one names what moved.
- Loop guard: a single monotonic `session id → {updated,directory,archived}`
  watermark map is fed from BOTH the periodic diffs AND this server's own
  live events (`globalEventHub.subscribeEvent` handling of
  `session.created`/`session.updated` info payloads; `session.deleted`
  drops the entry). A value the clients already received from our own
  stream can never be re-announced as external.
- First sight of a session seeds the watermark without emitting — session
  CREATION is out of scope (existing discovery paths and engine-side work
  cover it). `start()` performs one quiet baseline pass so a pre-existing
  session's first external update is already detectable.
- Failure is not empty: a list-read failure logs at warn, keeps all
  watermarks, and retries on the next signal; the first success retries at
  the poll interval until reached.
- `fs.watch` unavailable/erroring degrades to a stat-poll over the store
  files at `pollIntervalMs` (mtime+size fingerprint); a missing storage dir
  uses the same poll until the dir appears. `stop()` closes everything.

## Notes for contributors

- Do not import SQLite or read the store files' contents — the list API is
  the authority; files only carry "something moved, go look".
- Keep `diffSessionWatermarks` pure and loop-guard-complete: anything that
  emits must first pass strict-greater against the self-fed watermark.
- Emitted events must stay payloads-without-content; if a consumer needs
  data, it re-reads. Do not widen `updated` into "full session" here.

## Testing

- Run `bunx vitest run server/lib/session-store-freshness/runtime.test.js`
  from `packages/web` (or `bun run --cwd packages/web test` for the suite).
