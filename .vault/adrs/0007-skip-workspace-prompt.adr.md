---
type: adr
id: ADR-0007
title: "Skip Workspace Folder Prompt via Setting"
status: accepted
createdAt: "2026-06-14T15:30:00Z"
updatedAt: "2026-06-14T15:30:00Z"
tags: [settings, workspace, vscode-extension]
supersedes: []
superseded_by: []
see_also: ["concepts/0002-feature-flags-system.concept.md"]
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0007: Skip Workspace Folder Prompt via Setting

## Context

The `openchamber.newSession` command shows a QuickPick dialog when 2+ VS Code workspace folders are open, asking the user to select which folder to use for the new session. For users who consistently work with the same set of workspace folders and don't care which one is selected, this prompt is unnecessary friction.

No existing setting in `~/.config/openchamber/settings.json` controlled this behavior — the QuickPick was shown unconditionally.

## Decision

Add `skipWorkspacePrompt: boolean` to `~/.config/openchamber/settings.json`. When `true`, the first workspace folder (alphabetically sorted) is auto-selected instead of showing the QuickPick.

The setting is read via the existing `readOpenChamberSettings()` function in `opencode.ts`, which was exported from that module to share with `extension.ts`.

**Implementation:**

- `packages/vscode/src/opencode.ts` — exported `readOpenChamberSettings()` (additive change)
- `packages/vscode/src/extension.ts` — added `skipPrompt` check before QuickPick conditional at line 472-473

```typescript
const skipPrompt = (readOpenChamberSettings().skipWorkspacePrompt as boolean | undefined) === true;
folderPath = (candidates.length === 1 || skipPrompt)
  ? candidates[0].path
  : (await vscode.window.showQuickPick(...))?.path;
```

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| `skipWorkspacePrompt: boolean` (chosen) | Simple, minimal code, solves user's stated need | Doesn't allow picking a specific folder | — |
| `defaultWorkspaceFolderIndex: number` | Allows picking a specific folder | Over-engineered for stated needs | Not needed yet |
| Hardcode first folder always | No config needed | Removes user choice entirely, no way to get QuickPick back | Too destructive |

## Consequences

- **Positive:** Two-line logic change, zero new dependencies, safe fallback (when flag is absent/false, current behavior is preserved)
- **Negative:** User can't control which folder is picked (only first alphabetically). If this becomes a problem, a follow-up setting can be added.
- **Neutral:** `readOpenChamberSettings()` becomes part of the public API of `opencode.ts` — future callers must consider it stable (unlikely to be an issue)
