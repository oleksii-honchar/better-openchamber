---
type: adr
id: ADR-0001
title: "Fork Divergence and Rebase Strategy for better-openchamber"
status: accepted
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, rebase, governance]
supersedes: []
superseded_by: []
see_also:
  - "concepts/0001-better-openchamber-fork.concept.md"
  - "concepts/0003-upstream-divergence.concept.md"
  - "runbooks/0001-rebase-better-openchamber.runbook.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0001: Fork Divergence and Rebase Strategy for better-openchamber

## Context

The `better-openchamber` fork of `btriapitsyn/openchamber` is maintained on the `patched/main` branch. As of June 12, 2026:

- **Fork commits:** 4 (ahead of upstream)
- **Upstream commits:** 197 (since fork at merge base `bdaade01`)
- **Upstream releases missed:** 6 (v1.11.7 → v1.12.4)
- **Merge base:** `bdaade01` — "fix: session rename exits immediately due to focus race (#1429)"

The 4 fork commits add: feature flags, editable subagents, multi-root workspace folders, invalid tool rendering, local SDK alias, VSIX build scripts, Bun polyfills, provider logos, and fork documentation. These must survive any sync with upstream.

A rebase simulation failed on the first commit (13 conflicting files), indicating significant effort required.

## Decision

**Adopt a rebase-based sync strategy** (not merge) to maintain a clean linear history, with these principles:

1. Rebasing onto `upstream/main` keeps "ours on top of theirs" semantics — future upstream syncs are simpler.
2. Merge commits would compound complexity over time; avoid `git merge upstream/main`.
3. During conflict resolution, **fork features always win** — preserve feature flags, workspace folders, tool rendering, and SDK alias.
4. Apply our 4 commits one at a time during rebase, resolving conflicts per commit.
5. Post-rebase verification covers all 11 fork features.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **Merge upstream/main** | Simpler conflict resolution (one big merge) | Creates merge commit; future syncs harder; history polluted | Linear history preferred |
| **Cherry-pick upstream changes selectively** | Only pick relevant changes | Misses 197 commits; high manual effort; fragile | Too error-prone |
| **Stay on current fork indefinitely** | Lowest effort now | Increasing divergence; missed security/stability fixes | Unsustainable |
| **Drop fork, re-implement features on latest upstream** | Clean slate | Massive rework; fork features would need full re-implementation | Extreme overkill |

## Consequences

- **Positive:** Clean linear history; predictable future rebases; all fork features preserved.
- **Negative:** Significant conflict resolution effort (~13 files in commit 1 alone); risk of breaking fork features if testing is insufficient.
- **Neutral:** Upstream's v1.12.4 added multi-root VS Code support (#1493) — may overlap with our workspace folders feature; need to review after rebase.
