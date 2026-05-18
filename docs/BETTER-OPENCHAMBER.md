# better-openchamber

## Purpose

A maintained fork of [OpenChamber](https://github.com/ahmedbouchakour1/openchamber) (VS Code extension for code exploration) that adds user-configurable escape hatches for recent restrictive changes while preserving all upstream behavior.

Primary motivation: **v1.11.1 read-only subagents** — The feature flag `subagents.editable` lets users opt out of read-only enforcement without waiting for upstream changes or losing other v1.11.1 improvements.

This fork mirrors the docs structure of `better-opencode` for consistency, with extension-specific features (Feature Flags, Spec-driven design).

---

## Scope: What This Fork Fixes Now

**v1.11.1 Subagent Read-Only Lock (#08)**

OpenChamber v1.11.1 (May 15–18, 2026) introduced `readOnly: true` for subagent sessions opened from the Context Panel and parent sessions via `Boolean(parentSession)` logic in `ChatContainer.tsx`. The fork adds a runtime escape hatch without touching all upstream code.

See **[FEATURES.md](./FEATURES.md)** and **spec/01-subagent-read-only-feature-flag.md**.

---

## Docs Structure

Mirrors `better-opencode/docs` for familiarity, adapted for VS Code extension development:

- **[FEATURES.md](./FEATURES.md)** — Current feature list and implementation status  
- **[GOVERNANCE.md](./GOVERNANCE.md)** — Decision log and process  
- **`spec/`** — Implementation specs for in-flight features (01-, 02-, etc.)  
- `scripts/build-vsix.sh` — On-demand VSIX builds from any branch

---

## Installation

### Prerequisites

- **macOS / Linux / Windows** (VS Code runtime)  
- **Node.js** 20+ and `npm`/`yarn`  
- **Git** — for rebasing upstream

### Clone the Fork

```bash
cd ~/www/misc
git clone https://github.com/oleksii-honchar/better-openchamber.git
cd better-openchamber
```

### Build VSIX (Development)

Create a local VSIX extension without code changes:

```bash
# From repo root
./scripts/build-vsix.sh --vsix-version "1.11.2-local" 
# Outputs: ~/Downloads/openchamber-1.11.2-local.xxxxx.vsix

# Install into VSCode/VsCodium
code --install-extension ~/Downloads/openchamber-1.11.2-local.xxxxx.vsix
```

Use `--vsix-name <name>` to customize output filename.

### Daily Development Loop

1. Make change in fork (e.g., add `subagents.editable` flag)  
2. Build VSIX: `./scripts/build-vsix.sh --vsix-version "dev-$(git rev-parse --short HEAD)"`
3. Install: `code --install-extension ~/Downloads/<built>.vsix`  
4. Test in VsCode with fresh workspace

---

## Branch Strategy

**Main branches**:

- `main` — Tracks OpenChamber `main`, PR-ready  
- `patched/dev` — Feature integration branch where all PRs merge before release candidate

**Workflow**:
1. Create feature branch from `patched/dev`
2. Implement change (add flag, add setting, update ChatContainer logic)  
3. Rebase onto `patched/dev` if needed (`git rebase -i`)  
4. Merge into `patched/dev`, then eventually PR to upstream or release as VSIX

---

## Current Active Work

**Feature #08 → Renumbered to #01: Editable Subagents**

Add `subagents.editable` feature flag (default `false`) that conditionally skips read-only enforcement in `ChatContainer.tsx` and `MessageBody.tsx`, allowing users to type into subagent sessions while keeping parent-session safety.

See **[spec/08-subagent-read-only-feature-flag.md]** — renamed from `08-...` to be the first active spec after docs bootstrap (previous specs 01–07 were Opencode-CLI specific; this is OpenChamber-specific).

---

## New in v1.11.x: Editable Subagents

OpenChamber v1.11.1 introduced read-only subagent sessions to preserve reference material, but this changed the expected behavior for many users. The `better-openchamber` fork adds control back via the `subagents.editable` feature flag.

### What is a Subagent?

A **subagent** (also called a **"subtask"**) is a spun-off session created when you click "Open Session" on a chat message from a subagent suggestion. These appear as separate tabs in the Context Panel, allowing you to continue specific threads without cluttering the main conversation.

### Changed Default Behavior (v1.11.2+)

**Important:** Starting with v1.11.2-better, subagents are **editable by default**. If you upgraded from v1.11.2 and notice you can suddenly type in subagent chats that were previously frozen, this is the cause — the default changed from `readOnly: true` to editable via `subagents.editable`.

### Enabling Editable Subagents

**Option 1: Settings UI (Recommended)**

The easiest way is through VS Code Settings:
1. Open Command Palette (⌘/Ctrl+Shift+P) → **"OpenChamber: Open Settings"**
2. Find **"Editable Subagents"** checkbox under OpenChamber settings
3. Check the box to enable typing in subagent chats

**Option 2: VS Code settings.json**

Add this to your workspace or user settings (`.vscode/settings.json` or `settings.json`):

```json
{
  "opencode.subagents.editable": true
}
```

**Option 3: Environment Variable** (Dev/CI)

For local development or CI environments, set the environment variable before launching VS Code:

```bash
export OPENCODE_SUBAGENTS_EDITABLE=true
code .
```

*Note: Requires VS Code restart to take effect.*

### Why This Matters

Without this feature flag, subagent sessions opened from the Context Panel are read-only (v1.11.1 behavior). With `subagents.editable` enabled, you can type directly in those spun-off sessions while still preserving the safety of parent session references.

---

## Comparison with better-opencode

| Aspect | better-opencode | better-openchamber |
|--------|----------------|-------------------|
| **Base** | Opencode CLI agent | OpenChamber VS Code extension |
| **Core issue** | Context loss after ~5 turns, repetitive loops | Read-only subagents in v1.11.1 losing editability |
| **Delivery** | Binary `~/bin/better-opencode` (bun scripts) | VSIX package (`vsce package`) |
| **Docs sync** | Shared `docs/` layout adapted for extension workflow | — |

Both use spec-driven development in `docs/spec/` and on-demand builds, but target different runtimes (CLI vs. Extension).

---

## Quick Start Checklist

New contributor setting up the fork:

- [ ] Clone to `~/www/misc/better-openchamber`  
- [ ] Verify docs structure exists (`FEATURES.md`, `GOVERNANCE.md`, `spec/`)
- [ ] Build initial VSIX with `./scripts/build-vsix.sh --vsix-version "1.11.2-test"`  
- [ ] Read `findings.md` from current session (v1.11.1 read-only commits)  
- [ ] Implement first feature flag (`subagents.editable`) in ChatContainer.tsx

---

## Links

- **OpenChamber upstream**: https://github.com/ahmedbouchakour1/openchamber  
- **Better Opencode (reference)**: https://github.com/anomalyco/better-opencode  
- **Current Session**: [ses_1c581a0e5ffeztZdz5gZ2qIRm3](file://~/.agent-sessions/26/05/18/260518-1947-openchamber-subagent-readonly/session.md)

---

**Last updated**: May 18, 2026 (v1.11.1 read-only freeze documentation + feature flag design complete)
