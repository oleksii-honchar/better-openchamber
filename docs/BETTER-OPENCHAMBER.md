# better-openchamber

## Purpose

A maintained fork of [OpenChamber](https://github.com/btriapitsyn/openchamber) (VS Code extension — see SECURITY.md: originally `ahmedbouchakour1/openchamber`, now maintained at `btriapitsyn/openchamber`) that adds fork-specific improvements while preserving all upstream behavior.

The fork tracks `upstream/main` on a `patched/main` branch and currently sits **4 commits ahead, 197 commits behind** (merge base `bdaade01`). It is **6 releases behind** upstream (v1.11.7 → v1.12.4).

**Primary goal:** Deliver fork-specific features (feature flags, multi-root workspace folders, invalid tool rendering, local SDK alias) on top of upstream while preparing for a clean rebase.

---

## Current Fork State (as of June 12, 2026)

| Metric | Value |
|--------|-------|
| **Current branch** | `patched/main` |
| **Upstream remote** | `btriapitsyn/openchamber` |
| **Merge base** | `bdaade01` — "fix: session rename exits immediately due to focus race (#1429)" |
| **Our commits since fork** | **4** |
| **Upstream commits behind** | **197** (6 releases: v1.11.7 → v1.12.4) |
| **Upstream repo** | `https://github.com/btriapitsyn/openchamber.git` |
| **Our origin** | `git@github.com:oleksii-honchar/better-openchamber.git` |

### Our 4 Commits

1. **`00cc7423`** — `chore: fork setup` (May 18, 2026) — Initial fork: docs, feature flags system, workspace folders, provider logos, translations, VSIX build script, Bun polyfills, test setup. 36 files changed.
2. **`fb4696ce`** — `docs` (May 27, 2026) — Documentation updates: clarified `$body_` workaround vs native SDK support in workspace folders spec.
3. **`b349078b`** — `fix: tool cal fixes` (Jun 5, 2026) — "Invalid" tool call rendering in chat UI (5 tool rendering files).
4. **`064b6858`** — `fix(vite.config): update SDK alias path` (Jun 11, 2026) — Point Vite SDK alias to local `better-opencode/packages/sdk` + remove `$body_` prefix workaround.

### Upstream Releases We're Missing

| Release | Key Changes |
|---------|-------------|
| **v1.11.7** | Chat rerender perf, queued messages, draft sessions |
| **v1.12.0** | Electron desktop, remote instances, session archive, mobile UX |
| **v1.12.1** | Changed files display, LSP tool output, streaming fixes |
| **v1.12.2** | Windows support, PR review CI |
| **v1.12.3** | Startup readiness, file tree reliability |
| **v1.12.4** | Session review, fast worktree flows, diagram editor, vim mode, TTS, macOS tray, multi-root VS Code (#1493), settings search |

### Upstream Multi-Root Consideration

Upstream v1.12.4 includes a multi-root VS Code workspace feature (#1493, `f2874fbc`) that may overlap with our `$body_` workaround + local SDK native field approach. This must be reviewed during rebase — upstream's solution may supersede or complement ours.

---

## Fork Features

See **[FEATURES.md](./FEATURES.md)** for full details.

1. **Feature Flags System** — Runtime feature flags (`subagents.editable`, `planMode.enabled`) with Settings UI toggle + env var fallback
2. **Editable Subagents** — `subagents.editable` flag restores editability for subagent chats (default: `true`)
3. **Multi-Root VS Code Workspace Folders** — Wire `workspaceFolders[]` end-to-end: extension → webview → SDK → server (with `$body_` prefix workaround for npm SDK; local SDK has native field)
4. **Invalid Tool Call Rendering** — Custom error UI for undefined tool calls (red border/background, error details)
5. **Local SDK Alias** — Vite config aliases `@opencode-ai/sdk/v2` → local `better-opencode/packages/sdk/js/dist/v2/client.js`
6. **Better Provider Logos** — Additional provider logos via `useProviderLogo.ts`
7. **VSIX Build Script** — On-demand VSIX builds from any branch (`scripts/build-vsix.sh`)
8. **Bun Polyfills** — `bun-polyfills.ts` for Bun compatibility
9. **Fork Documentation** — `docs/BETTER-OPENCHAMBER.md`, `docs/FEATURES.md`, `docs/GOVERNANCE.md`, `docs/spec/`

---

## Branch Strategy

```
upstream/btriapitsyn/openchamber
└── main
    │
    ▼ fork (oleksii-honchar/better-openchamber)
    └── patched/main          ← Working branch with our 4 commits
        ├── feat-01           ← Feature branches (merged)
        └── fix/invalid-tool-log
```

- **`patched/main`** — Working branch containing all fork features + synced with upstream via rebase
- **`patched/main-1/pre-squash`** — Pre-squash backup of earlier work
- **`main`** — Tracks upstream/main (may be behind)
- **Feature branches** — Branched off `patched/main`, merged back after rebase

---

## Rebase Plan (Next Steps)

A rebase onto `upstream/main` is the recommended approach (keeps clean linear history). The findings from the upstream diff analysis (see session `260612-1423-upstream-branch-diff`) identified:

### Rebase Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| **Commit 1 rebase** (`00cc7423`) | Resolve ~13 conflicting files (package.json, feature flags, settings, session-actions.ts, session-ui-store.ts, desktop.ts, client.ts, 3 VS Code providers, webview files, VS Code package.json) | **High** |
| **Commit 2 rebase** (`fb4696ce`) | Docs only, no code | **Trivial** |
| **Commit 3 rebase** (`b349078b`) | 5 tool rendering files (`ProgressiveGroup.tsx`, `ToolPart.tsx`, `toolPresentation.tsx`, `toolRenderUtils.ts`, `toolHelpers.ts`) — need to verify invalid tool rendering against upstream's reworked rendering paths | **Medium** |
| **Commit 4 rebase** (`064b6858`) | 2 files, but `session-actions.ts` has upstream changes (review flow, session share, decoupled UI) — ensure `$body_` workaround removal is correct | **Medium** |
| **Post-rebase testing** | Verify all 11 fork features still work | **Medium-High** |

### Key Conflict Zones

| File | Conflict Type |
|------|--------------|
| `package.json` | 30+ upstream changes |
| `OpenChamberVisualSettings.tsx` | Upstream rewrote extensively |
| `session-actions.ts` | Upstream review flow + decoupled UI |
| `desktop.ts` | Upstream Electron refactoring |
| `client.ts` | Multiple upstream SDK client changes |
| `session-ui-store.ts` | Multiple upstream changes |
| `packages/vscode/*` providers | Upstream extension updates |
| 5 tool rendering files (Commit 3) | Upstream reworked rendering paths |

### Fork Features That Must Survive Rebase

1. **Folder-specific configuration** — `.opencode/openagent.json`
2. **Feature flags system** — `useFeatureFlagsStore`, `featureFlags` in settings
3. **Multi-root VS Code workspace folders** — Full end-to-end chain
4. **Invalid tool rendering** — Custom error UI for undefined tools
5. **Local SDK path** — Vite alias to `better-opencode/packages/sdk`
6. **Better provider logos** — `useProviderLogo.ts` additions
7. **Fork documentation** — `docs/` directory
8. **VSIX build scripts** — `scripts/build-vsix.sh`
9. **Bun polyfills** — `bun-polyfills.ts`
10. **Test setup** — `ChatContainer.test.tsx`, `test-setup.ts`
11. **Desktop utilities** — `lib/desktop.ts` additions

---

## Installation

### Prerequisites

- **macOS / Linux / Windows** (VS Code runtime)
- **Node.js** 20+ and `npm`/`yarn`
- **Git** — for rebasing upstream

### Clone the Fork

```bash
cd ~/www/misc
git clone git@github.com:oleksii-honchar/better-openchamber.git
cd better-openchamber
```

### Build VSIX (Development)

```bash
# From repo root
./scripts/build-vsix.sh --vsix-version "1.12.4-local"
# Outputs: ~/Downloads/openchamber-1.12.4-local.xxxxx.vsix

# Install into VSCode/VsCodium
code --install-extension ~/Downloads/openchamber-1.12.4-local.xxxxx.vsix
```

### Daily Development Loop

1. Make change on feature branch off `patched/main`
2. Build VSIX: `./scripts/build-vsix.sh --vsix-version "dev-$(git rev-parse --short HEAD)"`
3. Install: `code --install-extension ~/Downloads/<built>.vsix`
4. Test in VsCode with fresh workspace

---

## Comparison with better-opencode

| Aspect | better-opencode | better-openchamber |
|--------|----------------|-------------------|
| **Base** | Opencode CLI agent | OpenChamber VS Code extension |
| **Core issue** | Context loss after ~5 turns, repetitive loops | Various fork extensions on OpenChamber |
| **Delivery** | Binary `~/bin/better-opencode` (bun scripts) | VSIX package (`vsce package`) |
| **Docs sync** | Shared `docs/` layout adapted for extension workflow | — |
| **Branch** | `patched/dev` (CLI agent) | `patched/main` (VS Code extension) |

---

## Links

- **Upstream**: https://github.com/btriapitsyn/openchamber
- **Our origin**: https://github.com/oleksii-honchar/better-openchamber
- **Better Opencode (reference)**: https://github.com/anomalyco/better-opencode
- **Rebase Diff Session**: `~/.agent-sessions/26/06/12/260612-1423-upstream-branch-diff/`
- **Findings Report**: `~/.agent-sessions/26/06/12/260612-1423-upstream-branch-diff/findings.md`

---

**Last updated**: June 12, 2026 (full fork state documentation for rebase planning)
