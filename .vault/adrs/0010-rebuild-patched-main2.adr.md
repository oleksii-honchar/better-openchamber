---
type: adr
id: ADR-0010
title: "Rebuild patched/main2 on Latest Upstream — Keep Only Better-OpenCode Integration Features"
status: accepted
createdAt: "2026-08-24T09:10:00Z"
updatedAt: "2026-08-24T09:10:00Z"
tags: [fork, rebuild, governance, upstream, sdk, meta-tool]
supersedes:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "adrs/0002-adapt-upstream-multi-root.adr.md"
  - "adrs/0006-extract-workspace-folders-paths.adr.md"
  - "adrs/0007-skip-workspace-prompt.adr.md"
superseded_by: []
see_also:
  - "adrs/0004-esbuild-options-alias-sdk.adr.md"
  - "adrs/0008-tool-use-log-format.adr.md"
  - "adrs/0009-rename-meta-tools.adr.md"
  - "concepts/0003-upstream-divergence.concept.md"
  - "runbooks/0001-rebase-better-openchamber.runbook.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0010: Rebuild patched/main2 on Latest Upstream — Keep Only Better-OpenCode Integration Features

## Context

The `better-openchamber` fork diverged from `btriapitsyn/openchamber`: **18 commits ahead /
1083 commits behind** `upstream/main` with **42 files modified by both sides**. The rebase
strategy of ADR-0001 (set when the fork was 4 ahead / 197 behind) had become
disproportionate to the divergence. Upstream had since shipped 538 fix commits and v1.20.0,
superseding most fork-only backports.

On 2026-08-24 the user made a final decision: **rebuild the fork on latest upstream main as
`patched/main2`**, carrying only the better-opencode integration features. All other fork
features are dropped.

## Decision

1. **Create `patched/main2` from `upstream/main`** (v1.20.0, `b63830545`, later
   `330410dba`) — clean slate, no conflict surface from the 1083-commit divergence.
2. **Keep only the better-opencode integration features:**
   - **F5** — Local SDK alias (`packages/vscode/vite.config.ts` → local better-opencode SDK)
   - **F6** — VSIX build script (`scripts/build-vsix.sh`)
   - **F8** — Bun polyfills (`packages/ui/src/bun-polyfills.ts`)
   - **F12** — Meta tool rename + `MetaToolPart` rendering (skill_search/meta_search/meta_use)
   - **F13** — Tool Use collapsed header format (`Tool Use "<innerName>"`)
3. **Drop** F1-F4, F7, F9-F11, F14-F18 (incl. multi-root workspace folders F3,
   skipWorkspacePrompt F11, feature flags F1, session-actions version reporting F16).
4. **Freeze `patched/main` as rollback** — untouched.
5. **Carry the fork vault (`.vault/`) and upstream `docs/`** into `patched/main2`;
   supersede the old rebase governance (ADR-0001) and keep dropped-feature ADRs as
   historical records.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **Selective cherry-pick** of Tier 1/2 upstream fixes | Keeps fork history | Incomplete sync; still 1000+ commits behind; high manual effort | User rejected |
| **Full rebase of all 18 fork commits** (ADR-0001) | Linear history | 42 shared files, huge conflict surface; most fork features dropped anyway | Disproportionate |
| **Keep all 15 fork features on the rebuild** | No lost features | Heavy merge burden onto rewritten upstream files; F1/F11/F16 have no upstream equivalent | Maintenance burden |
| **Keep F4 (invalid-tool rendering) with F12** | — | F12 verified independent of F4 (MetaToolPart references only meta_use/meta_search) | Unnecessary dependency |
| **Stay on `patched/main` as-is** | Lowest effort | Stale; misses security/stability fixes | Unsustainable |

## Consequences

- **Positive:** Clean, current baseline (v1.20.0); security/stability fixes from 538 upstream commits.
- **Positive:** Small, reviewable diff vs upstream — only the 5 kept features.
- **Positive:** `patched/main` remains as a safe rollback.
- **Positive:** F12/F13 verified independent of dropped F4.
- **Negative:** Dropped local features (multi-root, skipWorkspacePrompt, feature flags, etc.)
  must be re-requested if ever needed again.
- **Negative:** Upstream releases need a new sync cadence to prevent re-divergence.
- **Neutral:** Dropped-feature ADRs (ADR-0002/0006/0007) and concepts are retained in the
  vault as superseded historical records.
