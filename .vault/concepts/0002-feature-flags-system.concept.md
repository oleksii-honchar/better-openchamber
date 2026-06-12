---
type: concept
title: "Feature Flags System"
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, feature-flags, architecture]
see_also:
  - "concepts/0001-better-openchamber-fork.concept.md"
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Concept: Feature Flags System

## What

A runtime feature flag system implemented in the better-openchamber fork to control fork-specific behaviors without requiring code changes. The system uses a Zustand store (`useFeatureFlagsStore`) backed by settings UI toggles, with environment variable fallback.

**Current flags:**
- `subagents.editable` (default: `true`) — Allow editing in subagent chats
- `planMode.enabled` (default: `false`) — Enable plan mode UI

## Why

Provides user-configurable escape hatches for fork-specific behaviors without:
- Modifying upstream code paths indiscriminately
- Requiring per-feature environment variables
- Hard-coding behaviors that may conflict with upstream changes

## Key Details

- **Store:** `packages/ui/src/stores/useFeatureFlagsStore.ts` — Zustand store
- **API:** `packages/ui/src/lib/featureFlags.ts` — `getFeatureFlag()` + `useFeatureFlag()` hook
- **Settings:** `packages/ui/src/lib/settings.ts` — TypeScript schema with `subagents.editable: boolean`
- **Config chain:** Settings UI → `window.opencodeSettings` → env var → default
- **Default for subagents:** `true` (editable by default — intentionally divergent from upstream's read-only)
- **5 files modified in commit 1** for feature flag support
