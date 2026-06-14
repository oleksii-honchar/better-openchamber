---
type: adr
id: ADR-0006
title: "Extract path from WorkspaceFolderCandidate[] for SDK"
status: accepted
createdAt: "2026-06-14T16:00:00Z"
updatedAt: "2026-06-14T16:00:00Z"
tags: [sdk, workspace-folders, type-safety]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0002-adapt-upstream-multi-root.adr.md"
  - "adrs/0004-esbuild-options-alias-sdk.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0006: Extract path from WorkspaceFolderCandidate[] for SDK

## Context

The `__VSCODE_CONFIG__` object contains `workspaceFolders` as `WorkspaceFolderCandidate[]` (objects with `name` and `path` properties). The SDK's `session.create` expects `workspaceFolders` as `Array<string>` (directory paths). The code in `session-ui-store.ts` was typed as `string[]` but the actual runtime data was `WorkspaceFolderCandidate[]`, creating a type mismatch that was masked by the `as Record<string, unknown>` cast.

## Decision

Extract the `path` property from each `WorkspaceFolderCandidate` before passing to `createSession`:

```ts
const wsFoldersRaw = (window as unknown as { __VSCODE_CONFIG__?: { workspaceFolders?: WorkspaceFolderCandidate[] } }).__VSCODE_CONFIG__?.workspaceFolders
const wsFolders = wsFoldersRaw?.map((wf) => wf.path).filter((p): p is string => Boolean(p)) ?? null
```

Applied at both locations in `session-ui-store.ts`:
- `sendMessage` method (line ~747)
- `createSessionFromAssistantMessage` method (line ~1129)

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **Extract paths** (chosen) | Correct type for SDK, explicit data transformation, type guard ensures `string[]` | Requires knowledge of `WorkspaceFolderCandidate` structure | — |
| Pass objects as-is | Works with current `as Record<string, unknown>` cast | SDK's `buildClientParams` serializes the objects as JSON; server may not understand | Rejected |
| Use `$body_` prefix workaround | Was used in older version | Requires adding the prefix workaround back — was removed intentionally | Rejected |

## Consequences

- **Positive:** `workspaceFolders` will be correctly typed as `Array<string>` matching the SDK's expectation.
- **Positive:** The server receives workspace folder paths (e.g., `["/Users/oleksii.honchar/www/misc/better-openchamber"]`) instead of serialized objects.
- **Positive:** The type guard `(p): p is string` ensures the filtered array is `string[]`, not `(string | undefined)[]`. No `any` types.
