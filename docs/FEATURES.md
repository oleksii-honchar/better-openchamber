# better-openchamber Features

VS Code extension features added or modified by the `better-openchamber` fork. Organized by current state.

For overview, see [BETTER-OPENCHAMBER.md](./BETTER-OPENCHAMBER.md).

---

## ✅ Complete Features

### 1. Feature Flags System

**Status:** ✅ Complete (shipped in fork commit `00cc7423`)

A runtime feature flag system implemented in the fork that controls fork-specific behaviors:

- **Store:** `packages/ui/src/stores/useFeatureFlagsStore.ts` — Zustand store with `planModeEnabled` and `editableSubagents` flags
- **API:** `packages/ui/src/lib/featureFlags.ts` — `getFeatureFlag()` and `useFeatureFlag()` hook with Settings UI → env var fallback chain
- **Default:** Editable subagents default to `true`; plan mode defaults to `false`

### 2. Editable Subagents (`subagents.editable`)

**Status:** ✅ Complete (shipped in fork commit `00cc7423`)

📋 [Detailed Spec](./spec/01-subagent-read-only-feature-flag.md)

Restores editability for subagent (subtask/spun-off) sessions via the `subagents.editable` feature flag.

**How it works:**
- `ChatContainer.tsx`: `const promptReadOnly = readOnly || (!allowEditableSubagents && Boolean(parentSession))`
- `useFeatureFlagsStore.ts`: Default `editableSubagents: true`
- `settings.ts`: TypeScript schema with `subagents.editable: boolean` (default `true`)

**Configuration:**

| Method | Value |
|--------|-------|
| **Settings UI** | OpenChamber Settings → Features → Editable Subagents |
| **settings.json** | `"openchamber.subagents.editable": true/false` |
| **Default** | `true` (editable by default) |

### 3. Multi-Root VS Code Workspace Folders

**Status:** ✅ Complete (shipped in fork commits `00cc7423` + `064b6858`)

📋 [Detailed Spec](./spec/02-workspace-folders-multi-root.md)

Wires `workspaceFolders[]` end-to-end from VS Code extension → webview → SDK → server, so multi-root workspaces see all folders instead of just the first one.

**Data flow:**
```
VS Code (vscode.workspace.workspaceFolders)
  → webviewHtml.ts (compute, inject into __VSCODE_CONFIG__)
    → webview (read from __VSCODE_CONFIG__)
      → session-actions.ts (SDK call)
        → server → DB (workspace_folders column)
          → system prompt (<env> block)
```

**SDK workaround:** Uses `$body_workspaceFolders` prefix for npm SDK v1.14.19 (which silently drops unknown keys in `buildClientParams`). The local SDK at `better-opencode/packages/sdk` has `workspaceFolders` as a native field.

**Evolution:** Originally shipped with `$body_` prefix workaround (commit 1), then updated to remove prefix when local SDK alias was added (commit 4: `064b6858`).

**⚠️ Upstream overlap:** Upstream v1.12.4 added multi-root VS Code support (#1493). Must review during rebase.

### 4. Invalid Tool Call Rendering

**Status:** ✅ Complete (shipped in fork commit `b349078b`, Jun 5, 2026)

Custom error UI for undefined tool calls (`invalid` tool type):

| File | Change |
|------|--------|
| `ProgressiveGroup.tsx` | Error-colored title/description for `invalid` tool group |
| `ToolPart.tsx` | Full expanded error view with red border/background showing tool name + error message |
| `toolPresentation.tsx` | `alert-circle` icon with error color for `invalid` tool |
| `toolRenderUtils.ts` | Added `invalid` to `EXPANDABLE_TOOL_NAMES` |
| `toolHelpers.ts` | Added `invalid` to `TOOL_METADATA` with `tool` and `error` fields |

**⚠️ Rebase risk:** All 5 files were also modified by upstream (diagram editor, LSP tool output, Electron support). Must verify our rendering still works after upstream rewrites.

### 5. Local SDK Alias

**Status:** ✅ Complete (shipped in fork commit `064b6858`, Jun 11, 2026)

Vite config aliases `@opencode-ai/sdk/v2` → local `better-opencode/packages/sdk/js/dist/v2/client.js`.

**Benefits:**
- Uses the local SDK's native `workspaceFolders` field (no `$body_` prefix needed)
- Tracks SDK changes made in the better-opencode monorepo
- Bypasses npm SDK v1.14.19 field definition limitations

**Files:**
- `packages/vscode/vite.config.ts` — Alias config
- `packages/ui/src/sync/session-actions.ts` — Removed `$body_` prefix workaround

### 6. VSIX Build Script

**Status:** ✅ Complete (shipped with fork)

`scripts/build-vsix.sh` enables building VSIX extensions from any branch without dirtying git version:

```bash
./scripts/build-vsix.sh --vsix-version "1.12.4-local"
./scripts/build-vsix.sh --vsix-name myfork --vsix-version dev-latest
```

Temporarily sets `package.json` version, builds VSIX, then reverts.

### 7. Better Provider Logos

**Status:** ✅ Complete (shipped with fork)

Additional provider logos via `packages/ui/src/hooks/useProviderLogo.ts` and desktop utilities in `packages/ui/src/lib/desktop.ts`.

**⚠️ Rebase note:** Upstream deleted many provider logo SVGs. Verify compatibility during rebase.

### 8. Bun Polyfills

**Status:** ✅ Complete (shipped with fork)

`packages/ui/src/bun-polyfills.ts` for Bun compatibility.

### 9. Test Setup

**Status:** ✅ Complete (shipped with fork)

- `ChatContainer.test.tsx` — Test for subagent session handling
- `test-setup.ts` — Test infrastructure

### 10. Folder-Specific Configuration

**Status:** ✅ Complete (shipped with fork)

Agent config overrides via `.opencode/openagent.json` — per-folder configuration for the OpenCode agent.

---

## Future Candidates (Tracked)

The following may warrant fork-specific work after rebase:

- **Session-level read-only modes** — If upstream adds global read-only toggles
- **Context Panel embedded vs. dedicated view toggle** — UX preference
- **Provider logo restoration** — If upstream deletions affect our additions

---

## Comparison with better-opencode

| Feature | better-opencode (CLI) | better-openchamber (Extension) |
|---------|---------------------|-------------------------------|
| Feature flags | N/A | `subagents.editable`, `planMode.enabled` |
| Workspace folders | N/A (CLI has cwd) | Full end-to-end multi-root support |
| Tool rendering | Standard | Extended with `invalid` tool UI |
| SDK | Local alias | Local alias to better-opencode SDK |
| Provider logos | N/A | Extended provider logo set |

---

**Last updated**: June 12, 2026 (full fork state after upstream diff analysis)
