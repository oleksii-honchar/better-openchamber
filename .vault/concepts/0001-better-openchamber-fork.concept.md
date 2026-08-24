---
type: concept
title: "better-openchamber Fork"
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, openchamber, vs-code-extension]
see_also:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "concepts/0002-feature-flags-system.concept.md"
  - "concepts/0003-upstream-divergence.concept.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Concept: better-openchamber Fork

## What

A maintained fork of OpenChamber (VS Code extension, originally `ahmedbouchakour1/openchamber`, now `btriapitsyn/openchamber`). The fork adds runtime feature flags, multi-root workspace folder support, invalid tool call rendering, and other quality-of-life improvements on top of the upstream OpenChamber codebase.

The fork lives at `oleksii-honchar/better-openchamber` with `patched/main` as the working branch (4 commits ahead, 197 behind upstream/main).

## Why

- Delivers fork-specific improvements (feature flags, workspace folders) that aren't available in upstream OpenChamber
- Maintains ability to sync with upstream via rebase
- Uses VSIX distribution model for immediate installation in VS Code/VsCodium
- Shares docs structure with `better-opencode` (CLI agent) for consistency

## Key Details

- **Remotes:** `origin` (fork at `git@github.com:oleksii-honchar/better-openchamber.git`), `upstream` (`https://github.com/btriapitsyn/openchamber.git`)
- **Active branch:** `patched/main` (not `main`)
- **Upstream repository:** Changed from `ahmedbouchakour1/openchamber` to `btriapitsyn/openchamber` after fork
- **11 fork features** must survive rebase (see FEATURES.md)
- Similar to `better-opencode` fork in structure but targets VS Code extension, not CLI
