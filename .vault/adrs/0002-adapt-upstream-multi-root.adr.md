---
type: adr
id: ADR-0002
title: "Adopt Upstream's Multi-Root Workspace Approach"
status: superseded
createdAt: "2026-06-12T18:00:00Z"
updatedAt: "2026-08-24T09:10:00Z"
tags: [fork, rebase, multi-root, upstream, workspace-folders]
supersedes: []
superseded_by:
  - "adrs/0010-rebuild-patched-main2.adr.md"
see_also:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "adrs/0003-opencode-client-sdk.adr.md"
  - "concepts/0003-upstream-divergence.concept.md"
deprecated:
  date: "2026-08-24"
  reason: "Multi-root workspace feature (F3) dropped in the patched/main2 rebuild (user decision 2026-08-24, ADR-0010). Kept for historical record."
  superseded_by: "adrs/0010-rebuild-patched-main2.adr.md"
---

# ADR-0002: Adopt Upstream's Multi-Root Workspace Approach

## Context

Upstream v1.12.4 added multi-root workspace support (#1493) with `WorkspaceFolderCandidate` type, `resolveWorkspaceFolders()`, `syncWorkspaceFolders()` method, and proper integration into `createNewSession(options)`. Our fork used a raw `string[]` approach with manual `.map()` in ChatViewProvider.

The rebase session (260612-1559-rebase-openchamber) confirmed that upstream's approach is structurally superior: typed interface, deduplication, normalization, and sorting — whereas our approach was a manual workaround.

## Decision

**Accept upstream's client-side multi-root approach entirely** and adapt our server-side `workspaceFolders` to work with it:

1. Replace fork's raw `string[]` with upstream's `WorkspaceFolderCandidate[]` type
2. Replace fork's manual `.map()` with upstream's `resolveWorkspaceFolders()` function
3. Use upstream's `createNewSession(options)` signature with `directory` and `workspaceFolders` parameters
4. Use upstream's `syncWorkspaceFolders()` method in ChatViewProvider

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **Fight upstream** — Keep fork's raw `string[]` | Minimal change needed | Creates divergence; duplicates upstream logic; maintenance burden | Overridden during rebase |
| **Drop workspaceFolders** — Remove server-side persistence | No conflict | Core fork feature — server needs folder context for `<env>` injection | Out of scope |
| **Adapt to upstream** — Use `WorkspaceFolderCandidate` | Reuses upstream code; cleaner; less to maintain | Must adapt server-side to extract `path` from candidates | **Chosen** |

## Consequences

- **Positive:** Upstream handles deduplication, normalization, and sorting of workspace folders. Less fork-specific code to maintain.
- **Positive:** Server still receives `string[]` via `candidates.map(c => c.path)` — no server-side change needed.
- **Neutral:** The fork now has both upstream's client-side multi-root UX AND fork's server-side persistence. These are complementary (upstream = UI selection; fork = data persistence for agent context).
- **⚠️ Future risk:** Upstream may add server-side multi-root support in a future release, requiring re-evaluation of our server-side approach.
