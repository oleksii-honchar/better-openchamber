---
type: adr
id: ADR-0005
title: "Validate directory Before SDK Call"
status: accepted
createdAt: "2026-06-14T16:00:00Z"
updatedAt: "2026-06-14T16:00:00Z"
tags: [validation, session-creation, sdk, directory]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0003-opencode-client-sdk.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0005: Validate directory Before SDK Call

## Context

The `createSession` function in `packages/ui/src/sync/session-actions.ts` passes `directory: directoryOverride ?? dir()` to the SDK. When both resolve to `undefined`, the SDK's `buildClientParams` includes it as a key with `undefined` value, which gets serialized as the literal string `"?directory=undefined"` in the HTTP query string. VS Code's extension host IPC rejects this malformed request with "Message send failed: Failed to create session".

## Decision

Add early validation in `createSession` that fails fast with a clear error when no directory is available:

```ts
const directory = directoryOverride ?? dir()
if (!directory) {
  console.error('[session-actions] createSession: no directory available — cannot create session')
  return null
}
```

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **Early validation** (chosen) | Fails fast with clear error, no malformed HTTP request | Two callers (`TextSelectionMenu`, `useBrowserVoice`) may fail if no workspace open | — |
| Omit `directory` key when undefined | SDK would not include the query param | SDK's `buildClientParams` includes `undefined` values as keys — would need to modify SDK behavior | Rejected |
| Default to `process.cwd()` | Always has a directory | Incorrect — session should be created in the workspace context, not arbitrary CWD | Rejected |

## Consequences

- **Positive:** Sessions cannot be created without a directory context — this is the correct behavior. A session without a directory is invalid.
- **Positive:** Early `return null` prevents unnecessary network requests and gives a clear debug signal via `console.error`.
- **⚠️ Note:** Two existing callers (`TextSelectionMenu.tsx`, `useBrowserVoice.ts`) that rely on `dir()` fallback will now fail fast if no workspace is open. Both already handle the `null` return value via the `if (!created?.id)` pattern.
