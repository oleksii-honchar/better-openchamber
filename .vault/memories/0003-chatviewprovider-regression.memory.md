---
type: memory
title: "ChatViewProvider.ts Regression After Squash Rebase"
createdAt: "2026-06-12T18:00:00Z"
updatedAt: "2026-06-12T18:00:00Z"
tags: [fork, rebase, regression, gotcha, chatviewprovider]
see_also:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "runbooks/0001-rebase-better-openchamber.runbook.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: ChatViewProvider.ts Regression After Squash Rebase

## Fact

During the squash rebase of `patched/main` onto `upstream/main` (session 260612-1559-rebase-openchamber), ChatViewProvider.ts lost 4 upstream methods during conflict resolution:
1. `resolveWorkspaceFolders` import
2. `createNewSession(options?: { directory, workspaceFolders })` signature
3. `syncWorkspaceFolders(workspaceFolders)` method
4. `reloadOpenCode()` method

The squash rebase merged our fork's version with upstream, and the upstream additions were accidentally dropped in the conflict resolution.

## Context

The first review of the rebase (before fix commit) found these 4 critical regressions. ChatViewProvider.ts had diverged from upstream/main — our version was missing upstream's multi-root methods. The fix commit `f61c70f5` restored all 4 methods, bringing the file to 0 diff with upstream/main.

## Impact

- **Lesson:** When squashing multiple commits during rebase, always verify that upstream's new methods (not just ours) survive the conflict resolution in files that were heavily modified by both sides.
- **Action:** Post-rebase verification must compare heavily-modified files (ChatViewProvider.ts, session-actions.ts) against upstream/main using `git diff upstream/main -- <file>` to catch dropped upstream methods.
- **Runbook update:** The rebase runbook now includes this verification step in Phase 4.
