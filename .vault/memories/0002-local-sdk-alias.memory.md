---
type: memory
title: "Local SDK Alias Replacing npm SDK Workaround"
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, sdk, vite, configuration]
see_also:
  - "concepts/0003-upstream-divergence.concept.md"
  - "memories/0001-npm-sdk-body-prefix-workaround.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: Local SDK Alias Replacing npm SDK Workaround

## Fact

Commit `064b6858` (Jun 11, 2026) changed the Vite config to alias `@opencode-ai/sdk/v2` → `better-opencode/packages/sdk/js/dist/v2/client.js`. This removed the need for the `$body_` prefix workaround in `session-actions.ts` because the local SDK has `workspaceFolders` as a native field.

## Context

The fork of better-openchamber depends on better-opencode's SDK fork. The npm-published SDK doesn't include `workspaceFolders` in its field definitions. By aliasing to the local SDK build, we get native support for `workspaceFolders` and avoid the `$body_` workaround.

## Impact

- **Positive:** Cleaner code — removed `$body_workspaceFolders` in favor of native `workspaceFolders`
- **Positive:** Tracks SDK changes in the better-opencode monorepo
- **⚠️ Rebase risk:** If upstream changed `session-actions.ts` (which it did — review flow, session share, decoupled UI), the removal of `$body_` must be re-verified after rebase
- The Vite config change (`vite.config.ts`) is isolated — low conflict risk
