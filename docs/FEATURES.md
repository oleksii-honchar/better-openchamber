# better-openchamber Features

VS Code extension features added or modified by the `better-openchamber` fork to preserve flexibility while tracking upstream improvements.

For overview, see [BETTER-OPENCHAMBER.md](./BETTER-OPENCHAMBER.md).

---

## 1. Editable Subagents Feature Flag (`subagents.editable`)

📋 [Detailed Spec](./spec/01-subagent-read-only-feature-flag.md)

**Status:** ✅ In-flight — PR open for feature flag implementation  
**v1.11.1 Freeze Date:** May 15, 2026

### Problem

OpenChamber v1.11.1 enforced read-only mode on subagent (subtask) sessions via two commits:

- **`526f9a51`**: Opens subagent sessions in Context Panel with `readOnly: true` hardcoded when clicking "Open session" from MessageBody.tsx  
- **`e2f45bda`**: Enforces input-level read-only via `const promptReadOnly = readOnly || Boolean(parentSession)` in ChatContainer.tsx

Previously, users could edit subagent chats as sibling conversations after forking from a parent. The change was intentional: treat subagents as reference sessions viewable inline but not editable independently. However, some workflows prefer editable subagents while maintaining parent-safety constraints.

### Solution

Add runtime feature flag `subagents.editable` (default `false`) that conditionally skips read-only enforcement:

**In ChatContainer.tsx (~line 540):**
```tsx
const allowEditableSubagents = features?.get('subagents.editable') === 'true';
// Old: const promptReadOnly = readOnly || Boolean(parentSession);
const promptReadOnly = readOnly || (!allowEditableSubagents && Boolean(parentSession));
```

**In MessageBody.tsx (~line 160, optional):**
When opening from "Open session" link:
```tsx
readOnly: !allowEditableSubagents,  // ← Toggleable instead of always true
```

### Configuration Options

**Option A: Settings UI Toggle** (Planned)  
### Implementation

A checkbox toggle in Settings UI (`Features` > `Editable Subagents`) allows users to opt-in to editable subagent chats:

**Settings JSON** (manual):
```jsonc
{
  "openchamber.subagents.editable": true
}
```

When enabled, subagent sessions opened from parent session links are fully writable.

### Files Modified

1. `packages/ui/src/components/chat/ChatContainer.tsx` — Add feature flag check (~5 lines)  
2. `packages/ui/src/lib/settings.ts` — Define schema and getter for Settings-based toggle

### Files Modified

1. `packages/ui/src/components/chat/ChatContainer.tsx` — Add feature flag check (~5 lines)  
2. `packages/ui/src/lib/features/definitions.ts` — Register toggle definition (or settings schema if using Option A)

### Testing Matrix

| Scenario | Flag Value | Expected |
|----------|------------|----------|
| Default upstream | false/unset | Subagents read-only (v1.11.2 behavior) |
| Flag enabled | true | Can type into subagent sessions; Context Panel shows editable tabs |
| Parent safety | any | Main parent session remains fully interactive |

---

## 2. Multi-Root Workspace Folders (`workspaceFolders`)

📋 [Detailed Spec](./spec/02-workspace-folders-multi-root.md)

**Status:** ✅ Complete

### Problem

In multi-root VS Code workspaces, only the first workspace folder was visible to the server. The `workspaceFolders` array was never transmitted through the SDK — it was silently dropped by `buildClientParams` because `workspaceFolders` is not in the SDK v2's field definition for `Session2.create`. The server's `workspace_folders` DB column was always `null`.

### Solution

Wired `workspaceFolders` end-to-end:

1. **VS Code extension** computes `workspaceFolders` array from `vscode.workspace.workspaceFolders` (with `normalizeWindowsDriveLetter`), injects into `__VSCODE_CONFIG__`
2. **Openchamber UI** reads `workspaceFolders` from `__VSCODE_CONFIG__` and passes it to SDK with the `$body_` prefix workaround (`$body_workspaceFolders`) to bypass the npm SDK v1.14.19's field definition gap (the local SDK has native support)
3. **Server** receives `workspaceFolders` in `CreateInput.body`, stores in DB, injects into `<env>` system prompt

### Key Detail: `$body_` Prefix Workaround

The npm SDK v1.14.19's `buildClientParams` silently drops unknown keys. Using `$body_workspaceFolders` forces the key into the request body because `$body_` is a recognized prefix (`$body_: "body"` in `params.gen.js`) that strips the prefix and places the value in `params.body`. The `as Record<string, unknown>` type cast bypasses TypeScript checking (exacerbated by `skipLibCheck: true`).

**Note:** The local SDK at `better-opencode/packages/sdk` has `workspaceFolders` as a native field (sdk.gen.ts:3101). The standalone app uses the native field directly. Only the OpenChamber extension's npm SDK dependency requires the workaround. The proper fix is to update the npm SDK to include `workspaceFolders` in the session create field definition.

### Files Modified

7 files across `packages/vscode` and `packages/ui` — see [spec](./spec/02-workspace-folders-multi-root.md) for details.

---

## 3. On-Demand VSIX Build Script

**Status:** ✅ Complete  

`scripts/build-vsix.sh` enables building VSIX extensions from any branch without dirtying git version:

```bash
# Quick local build with temp version suffix
./scripts/build-vsix.sh --vsix-version "1.11.2-local" 
# Outputs: ~/Downloads/openchamber-1.11.2-local.xxx.vsix

# Custom naming
./scripts/build-vsix.sh --vsix-name myfork --vsix-version dev-latest
```

See [BETTER-OPENCHAMBER.md](./BETTER-OPENCHAMBER.md) for quick start workflow.

---

## Future Candidates (Tracked)

The following upstream features may warrant fork-specific escape hatches if restrictive:

- **Session-level read-only modes** — If upstream adds global read-only toggles, fork may provide per-session overrides  
- **Context Panel embedded vs. dedicated view toggle** — Current behavior opens in panel; some users may prefer replacing main chat for subagents

---

## Comparison with better-opencode

| Feature | better-opencode (CLI) | better-openchamber (Extension) |
|---------|---------------------|-------------------------------|
| `tool.execute.after` | Inject synthetic messages after tools | N/A — Extension runtime differs |
| Session ID in prompt | Yes (survives compaction) | Likely via extension context, not LLM system prompt compaction |
| Read-only escape hatches | N/A | Primary focus now (`subagents.editable`) |

The fork structure mirrors `better-opencode/docs` for consistency, but focuses on VS Code extension constraints rather than CLI session mechanics.

---

**Last updated**: May 24, 2026 (workspaceFolders multi-root feature documented)
