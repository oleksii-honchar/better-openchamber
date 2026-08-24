---
type: memory
title: "session-actions.ts Still Uses Old SDK Pattern (Follow-up)"
createdAt: "2026-06-12T18:00:00Z"
updatedAt: "2026-06-12T18:00:00Z"
tags: [fork, sdk, follow-up, session-actions, opencode-client]
see_also:
  - "adrs/0003-opencode-client-sdk.adr.md"
  - "memories/0001-npm-sdk-body-prefix-workaround.memory.md"
  - "memories/0002-local-sdk-alias.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: session-actions.ts Still Uses Old SDK Pattern (Follow-up)

## Fact

After the rebase (session 260612-1559-rebase-openchamber), `session-actions.ts` still uses `sdk().session.create()` instead of upstream's `opencodeClient.createSession()`. This works functionally (workspaceFolders data flow operates) but has gaps:

1. The `metadata` field from upstream's SDK is not utilized — `workspaceFolders` is passed as a direct parameter instead of via `metadata`
2. `patchSessionMetadata` is not exported — upstream's `reviewFlow.ts` can't import it
3. Dual SDK usage: `sdk()` for session creation, `opencodeClient` elsewhere in the codebase

## Context

The spec recommended adapting to `opencodeClient` (Open Decision 1: Option B). The rebase architect chose to keep `sdk()` for `session-actions.ts` because upstream had 7 commits touching this file — migrating during rebase would have created a much larger conflict. The reviewer flagged this as a medium-severity follow-up (not a regression).

## Impact

- **Current state:** Functional — the workspaceFolders feature works. Not broken.
- **Risk:** Upstream may deprecate `sdk()` in a future release. The dual SDK pattern increases maintenance burden.
- **Next step:** Migrate `session-actions.ts` to use `opencodeClient.createSession()` with `metadata` field in a follow-up commit.
