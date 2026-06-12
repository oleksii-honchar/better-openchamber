---
type: concept
title: "Upstream Divergence Landscape"
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, rebase, upstream, conflict]
see_also:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "concepts/0001-better-openchamber-fork.concept.md"
  - "memories/0001-npm-sdk-body-prefix-workaround.memory.md"
  - "memories/0002-local-sdk-alias.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Concept: Upstream Divergence Landscape

## What

The current state of divergence between `better-openchamber`'s `patched/main` and upstream `btriapitsyn/openchamber@main`. The fork is 4 commits ahead, 197 commits behind, with 6 releases missed.

## Why

Understanding the divergence landscape is critical for planning a successful rebase. The 197 upstream commits are organized into thematic categories that intersect with fork features in specific ways.

## Key Details

### Upstream Releases (v1.11.7 → v1.12.4)

| Release | Key Changes |
|---------|-------------|
| v1.11.7 | Chat rerender perf, queued messages, draft sessions |
| v1.12.0 | Electron desktop, remote instances, session archive, mobile UX |
| v1.12.1 | Changed files display, LSP tool output, streaming fixes |
| v1.12.2 | Windows support, PR review CI |
| v1.12.3 | Startup readiness, file tree reliability |
| v1.12.4 | Session review, fast worktree flows, diagram editor, vim mode, TTS, macOS tray, multi-root VS Code (#1493) |

### Our 4 Commits (cross-reference with upstream)

| Commit | Files | Overlap with Upstream |
|--------|-------|----------------------|
| 1 — fork setup (`00cc7423`) | 36 files, 1239 insertions | **HIGH** — 13 files also changed by upstream |
| 2 — docs (`fb4696ce`) | 2 docs files | **NONE** |
| 3 — tool cal fixes (`b349078b`) | 5 tool rendering files | **MEDIUM** — upstream reworked rendering paths |
| 4 — SDK alias (`064b6858`) | 2 files | **MEDIUM** — session-actions.ts changed by upstream |

### Conflict Zones

| File | Our Change | Upstream Changes | Severity |
|------|-----------|-----------------|----------|
| `package.json` | Fork setup | 30+ upstream changes | HIGH |
| `OpenChamberVisualSettings.tsx` | Feature flags | Extensive rewrite | HIGH |
| `desktop.ts` | Provider logos | Electron refactoring | HIGH |
| `client.ts` | SDK additions | Multiple changes | HIGH |
| `session-actions.ts` | workspaceFolders | Review flow, session share, decoupled UI | HIGH |
| `session-ui-store.ts` | workspaceFolders | Multiple changes | HIGH |
| 3 VS Code providers | workspaceFolders | Extension updates | MEDIUM |
| 5 tool rendering files | invalid tool UI | Diagram editor, LSP output | MEDIUM |
