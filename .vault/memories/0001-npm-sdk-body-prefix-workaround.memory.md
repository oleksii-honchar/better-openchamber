---
type: memory
title: "npm SDK $body_ Prefix Workaround for workspaceFolders"
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, sdk, workaround, gotcha]
see_also:
  - "concepts/0003-upstream-divergence.concept.md"
  - "memories/0002-local-sdk-alias.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: npm SDK $body_ Prefix Workaround for workspaceFolders

## Fact

The npm-published SDK v1.14.19 (`@opencode-ai/sdk`) silently drops `workspaceFolders` from session creation requests because `buildClientParams` doesn't have it in its field definition. The `$body_` prefix workaround (`$body_workspaceFolders`) forces the key into the HTTP request body.

## Context

When implementing multi-root workspace folder support, we discovered that passing `workspaceFolders` to `sdk().session.create()` had no effect — `buildClientParams` checks each key against a field definition map, and unknown keys are dropped. The `$body_` prefix is a recognized prefix in `params.gen.js` that strips the prefix and places the value in `params.body`.

## Impact

- Without the workaround, multi-root workspace folder support silently fails
- The `as Record<string, unknown>` type cast bypasses TypeScript checking (exacerbated by `skipLibCheck: true`)
- The local SDK at `better-opencode/packages/sdk/js/src/v2/gen/sdk.gen.ts:3101` has `workspaceFolders` as a native field — no workaround needed there
- Commit 4 (`064b6858`) removed the `$body_` workaround when switching to the local SDK alias
