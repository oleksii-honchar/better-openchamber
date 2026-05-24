# 02-workspace-folders-multi-root

## Context

The server-side chain for `workspaceFolders` (plural, multi-root) was already wired and accepts `workspaceFolders` in `CreateInput.body` (pre-existing from Phase 1). The database column `workspace_folders` exists in the `session` table as `text({ mode: "json" }).$type<string[]>()`.

The server reads `workspaceFolders` from the session create payload, stores it, and injects it into the system prompt `<env>` block:

```typescript
// session/system.ts
...(workspaceFolders && workspaceFolders.length > 0
  ? [`  ${workspaceFolders.length === 1 ? 'VS Code workspace folder:' : 'VS Code workspace folders:'} ${workspaceFolders.join(', ')}`]
  : []),
```

The gap was the **client-side chain**: VS Code extension → webview → SDK → server. The single `workspaceFolder` (singular) path was wired, but the plural `workspaceFolders` array was never sent from the extension through to the server.

## Problem

In multi-root VS Code workspaces, only the first workspace folder was visible to the server. The `workspaceFolders` array was never transmitted through the SDK, so `workspace_folders` was always `null` in the database and the `<env>` block never showed the full workspace context.

### Root Cause

The SDK v2's `Session2.create` uses `buildClientParams` with a field definition that maps known keys to `body`, `query`, or `path`:

```javascript
// @opencode-ai/sdk/dist/v2/gen/sdk.gen.js — Session2.create
const params = buildClientParams([parameters], [
  {
    args: [
      { in: "query", key: "directory" },
      { in: "query", key: "workspace" },
      { in: "body", key: "parentID" },
      { in: "body", key: "title" },
      { in: "body", key: "permission" },
      { in: "body", key: "workspaceID" },
    ],
  },
]);
```

**`workspaceFolders` is not in the field definition.** When `buildClientParams` encounters an unknown key:
1. It checks if the key is in the map — no
2. It checks if the key starts with a prefix like `$body_` — no
3. It checks `config.allowExtra` — not defined
4. **The key is silently dropped**

This means even though the code passed `workspaceFolders` in the SDK call, it was never included in the HTTP request body.

## Solution: Wire `workspaceFolders` end-to-end

### Data Flow

```
VS Code (vscode.workspace.workspaceFolders)
  → webviewHtml.ts (compute array, inject into __VSCODE_CONFIG__)
    → webview (read from __VSCODE_CONFIG__)
      → session-actions.ts (SDK call with $body_ prefix)
        → server (CreateInput.body.workspaceFolders)
          → DB (workspace_folders column)
            → system prompt (<env> block)
```

### Implementation

#### Step 1: VS Code Extension — Pass `workspaceFolders` to webview

**`packages/vscode/src/webviewHtml.ts`:**
- Added `workspaceFolders?: string[]` to `WebviewHtmlOptions` interface
- Destructured `workspaceFolders` in `getWebviewHtml()`
- Injected into `__VSCODE_CONFIG__` as `JSON.stringify(workspaceFolders || [])`

**`packages/vscode/src/ChatViewProvider.ts`:**
```typescript
const workspaceFolders = (vscode.workspace.workspaceFolders || []).map(
  (folder) => normalizeWindowsDriveLetter(folder.uri.fsPath)
);
```

**`packages/vscode/src/AgentManagerPanelProvider.ts`:** Same pattern.

**`packages/vscode/src/SessionEditorPanelProvider.ts`:** Same pattern.

All three providers compute the `workspaceFolders` array and pass it to `getWebviewHtml()`.

#### Step 2: Openchamber UI — Read `workspaceFolders` and pass to SDK

**`packages/ui/src/types/desktop.d.ts`:** Added `__VSCODE_CONFIG__` type declaration with `workspaceFolders?: string[]`.

**`packages/ui/src/sync/session-actions.ts`:**
```typescript
export async function createSession(
  title?: string,
  directoryOverride?: string | null,
  parentID?: string | null,
  workspaceFolders?: string[] | null,
): Promise<Session | null> {
  const result = await sdk().session.create({
    directory: directoryOverride ?? dir(),
    title,
    parentID: parentID ?? undefined,
    ...(workspaceFolders ? { $body_workspaceFolders: workspaceFolders } : {}),
  } as Record<string, unknown>)
  // ...
}
```

**Critical detail:** The `$body_` prefix is required because `workspaceFolders` is not in the SDK's `buildClientParams` field definition. The `$body_` prefix is recognized by `buildClientParams` (defined in `params.gen.js` as `$body_: "body"`), which strips the prefix and places the value in `params.body`. Without this prefix, the key is silently dropped.

**`packages/ui/src/sync/session-ui-store.ts`:**
- Updated `createSession` type signature to include `workspaceFolders` parameter
- Updated `createSession` action to accept and pass `workspaceFolders` to `createSessionAction`
- In `sendMessage` handler: reads `workspaceFolders` from `__VSCODE_CONFIG__` and passes to `createSession`
- In `createSessionFromAssistantMessage`: reads `workspaceFolders` from `__VSCODE_CONFIG__` and passes to `createSession`

### Backward Compatibility

- `workspaceFolder` (singular) is preserved alongside `workspaceFolders` (plural) for any existing consumers of `__VSCODE_CONFIG__.workspaceFolder`
- `workspaceFolders` is only added to the SDK body if the array is non-empty: `...(workspaceFolders ? { $body_workspaceFolders: workspaceFolders } : {})`

### Files Modified

1. `packages/vscode/src/webviewHtml.ts` — Added `workspaceFolders` to options, destructured, injected into `__VSCODE_CONFIG__`
2. `packages/vscode/src/ChatViewProvider.ts` — Computes and passes `workspaceFolders` to `getWebviewHtml`
3. `packages/vscode/src/AgentManagerPanelProvider.ts` — Computes and passes `workspaceFolders` to `getWebviewHtml`
4. `packages/vscode/src/SessionEditorPanelProvider.ts` — Computes and passes `workspaceFolders` to `getWebviewHtml`
5. `packages/ui/src/sync/session-actions.ts` — `createSession` accepts `workspaceFolders`, uses `$body_` prefix for SDK body
6. `packages/ui/src/sync/session-ui-store.ts` — `createSession` type + action updated; `sendMessage` and `createSessionFromAssistantMessage` read from `__VSCODE_CONFIG__`
7. `packages/ui/src/types/desktop.d.ts` — Added `__VSCODE_CONFIG__` type declaration with `workspaceFolders`

### Verification

After implementation, verify:
- `__VSCODE_CONFIG__.workspaceFolders` contains the correct array in the webview (check via Chrome DevTools)
- Creating a session in a multi-root workspace sends `workspaceFolders` in the session create body (check server logs)
- The server stores `workspace_folders` in the database (not `null`)
- The `<env>` block in the system prompt includes all workspace folders
- Single-root workspace still works (one folder in array)
- Empty workspace (no folders open) sends no `workspaceFolders` (empty object spread)

### SDK Limitation Note

The SDK v2 types do not include `workspaceFolders` in `SessionCreateData.body`. The `as Record<string, unknown>` cast bypasses TypeScript checking. When the SDK is regenerated from the OpenAPI spec, the field definition for `Session2.create` will need to include:

```javascript
{ in: "body", key: "workspaceFolders" },
```

Until then, the `$body_` prefix workaround is required. This is tracked as a known limitation.

---

**Related**: Server-side chain (Phase 1) already wired in `better-opencode` — `CreateInput`, `fromRow`, `toRow`, system prompt.
