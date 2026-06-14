---
type: adr
id: ADR-0003
title: "Use Upstream's opencodeClient Instead of Fork's sdk()"
status: accepted
createdAt: "2026-06-12T18:00:00Z"
updatedAt: "2026-06-12T18:00:00Z"
tags: [fork, rebase, sdk, opencode-client, metadata]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "adrs/0002-adapt-upstream-multi-root.adr.md"
  - "memories/0001-npm-sdk-body-prefix-workaround.memory.md"
  - "memories/0002-local-sdk-alias.memory.md"
  - "memories/0004-session-actions-sdk-followup.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0003: Use Upstream's opencodeClient Instead of Fork's sdk()

## Context

Upstream rewrote the SDK layer. Old pattern: `sdk().session.create()`. New pattern: `opencodeClient.createSession()`. The fork's `$body_` prefix workaround was specific to the old SDK's `buildClientParams` and is no longer needed.

However, the rebase left `session-actions.ts` still using `sdk().session.create()` instead of `opencodeClient.createSession()`. This works functionally (the workspaceFolders data flow operates) but lacks full upstream alignment:
- The `metadata` field from upstream's SDK is not utilized
- `patchSessionMetadata` is not exported (upstream's `reviewFlow.ts` can't import it)

## Decision

**Use upstream's `opencodeClient.createSession()`** as the canonical session creation method:

1. The `$body_` workaround is obsolete — upstream's client handles extra fields via `metadata`
2. The `as Record<string, unknown>` cast is no longer needed
3. `workspaceFolders` should be passed via the `metadata` field or as a direct parameter

**⚠️ Deferred:** The full migration of `session-actions.ts` from `sdk().session.create()` to `opencodeClient.createSession()` is deferred to a follow-up commit. The current rebase uses `sdk()` for this one call to avoid a larger conflict in `session-actions.ts`, which had 7 upstream commits touching it.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **Keep fork's sdk() path** — Maintain old SDK call | Works, minimal rebase effort | Parallel SDK usage; old SDK may be deprecated; doesn't use `metadata` | Deferred to follow-up |
| **Full migration during rebase** — Use `opencodeClient` in `session-actions.ts` | Full upstream alignment | Large conflict in `session-actions.ts` (7 upstream commits); riskier rebase | Too risky for rebase |
| **Use opencodeClient with metadata** — Post-rebase follow-up | Clean, aligned with upstream | Requires separate commit | **Chosen** — follow-up |

## Consequences

- **Positive:** Once migrated, the code aligns with upstream patterns and uses the `metadata` field
- **Negative:** Current state has dual SDK usage — `sdk()` for session creation, `opencodeClient` elsewhere
- **⚠️ Risk:** Upstream may deprecate the `sdk()` function in a future release
- **Positive:** The `workspaceFolders` data flow works in the current state — fork feature is functional
