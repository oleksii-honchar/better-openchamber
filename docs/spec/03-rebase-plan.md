# 03-rebase-plan

## Context

The `better-openchamber` fork is maintained on `patched/main` branch, currently **4 commits ahead** and **197 commits behind** upstream `btriapitsyn/openchamber@main`. The fork diverged from upstream at merge base `bdaade01` ("fix: session rename exits immediately due to focus race (#1429)").

Upstream has shipped **6 releases** since the fork (v1.11.7 → v1.12.4) with significant changes: Electron desktop support, mobile UX overhaul, multi-root VS Code support, diagram editor, vim mode, session review flow, and more.

A rebase was tested and **failed on the first commit** (`00cc7423` — chore: fork setup). The rebase simulation identified ~13 conflicting files with upstream changes.

## Problem

The fork is increasingly stale, missing 197 upstream commits and 6 releases. Continuing to work without rebasing creates:
1. **Increasing divergence** — Each new feature makes the rebase harder
2. **Missed upstream improvements** — Multi-root support (#1493), session review flow, security fixes
3. **Duplicate work risk** — Upstream may have already solved problems we solved in the fork
4. **Conflict accumulation** — Files modified by both sides grow in number

## Rebase Strategy

### Approach: Rebase onto `upstream/main` (not merge)

**Rationale:** A rebase keeps a clean linear history (`ours → on top of → theirs`), making future upstream syncs predictable. Merge commits would compound the complexity over time.

### Phase 1: Commit by Commit

Rebase applies our 4 commits in order onto `upstream/main`, resolving conflicts as they arise.

#### Commit 1: `00cc7423` — chore: fork setup
**Effort: HIGH** — ~13 conflicting files

| File | Conflict Type | Resolution Strategy |
|------|-------------|-------------------|
| `package.json` | 30+ upstream changes | Keep fork metadata (name, version schema) + merge upstream dependency changes |
| `OpenChamberVisualSettings.tsx` | Upstream rewrote extensively | Merge both sets of settings toggles — keep feature flags, adapt to upstream's new component structure |
| `desktop.ts` | Upstream Electron refactoring | Add our provider logo additions to upstream's new desktop structure |
| `client.ts` | Multiple upstream SDK client changes | Merge both — our additions + upstream's client updates |
| `session-actions.ts` | Review flow, session share, decoupled UI | Preserve workspaceFolders logic, adapt to upstream's new API |
| `session-ui-store.ts` | Multiple upstream changes | Merge both — preserve workspaceFolders support |
| `packages/vscode/package.json` | Extension config changes | Keep fork naming + VSIX config |
| `ChatViewProvider.ts` | Multi-root + session history fixes | Merge both — preserve workspaceFolders injection |
| `AgentManagerPanelProvider.ts` | Extension updates | Merge both |
| `SessionEditorPanelProvider.ts` | Extension updates | Merge both |
| `webviewHtml.ts` | Webview changes | Merge both — preserve workspaceFolders injection |
| `webview/main.tsx` | Webview changes | Merge both |
| `desktop.d.ts` | Desktop type changes | Auto-merge likely clean |

**Risk high files:** `session-actions.ts` and `session-ui-store.ts` — upstream made 7+ commits touching these. The review flow and session share changes fundamentally alter how sessions are created.

#### Commit 2: `fb4696ce` — docs
**Effort: TRIVIAL** — Only docs files, no code conflicts expected.

#### Commit 3: `b349078b` — fix: tool cal fixes
**Effort: MEDIUM** — 5 tool rendering files

All 5 files were modified by upstream (diagram editor, LSP tool output, Electron support). The rebase test auto-merged cleanly, but runtime correctness needs verification:
- `ToolPart.tsx` — Medium risk: upstream added tool rendering features near our invalid tool additions
- `ProgressiveGroup.tsx`, `toolPresentation.tsx`, `toolRenderUtils.ts`, `toolHelpers.ts` — Low risk: different sections of files

**Verification:** After rebase, test that `invalid` tool calls still render with red border/background and error message.

#### Commit 4: `064b6858` — fix(vite.config): update SDK alias path
**Effort: MEDIUM** — 2 files

- `packages/vscode/vite.config.ts` — Low risk: isolated config change
- `packages/ui/src/sync/session-actions.ts` — Medium risk: upstream changed this file for review flow. Must ensure `$body_` workaround removal is correct and doesn't break with upstream's version of the file.

### Phase 2: Post-Rebase Verification

After all commits are rebased, verify:

| Feature | How to Verify |
|---------|--------------|
| Feature flags | `subagents.editable` toggle works in settings |
| Editable subagents | Subagent chats are editable (default: `true`) |
| Multi-root folders | All workspace folders shown in `<env>` prompt block |
| Invalid tool rendering | Undefined tool calls show red border + error |
| SDK alias | Vite resolves to local `better-opencode/packages/sdk` |
| Provider logos | Icons render for all providers |
| VSIX build | `scripts/build-vsix.sh` completes successfully |
| Translations | All locale files load without errors |
| Test setup | `ChatContainer.test.tsx` passes |

### Phase 3: Upstream Feature Review

After rebase, review whether these upstream features supersede or complement our fork features:

1. **Upstream multi-root (#1493)** — Does it make our `$body_` workaround obsolete? Does it cover all our use cases?
2. **Upstream tool rendering** — Does the upstream rework of `ToolPart.tsx` affect our `invalid` tool rendering path? Should we contribute `invalid` rendering upstream?
3. **Upstream `session-actions.ts`** — Upstream's review flow and session share features may change the session creation API we modified for workspaceFolders.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Extended rebase downtime | Medium | Medium | Work on feature branch in parallel; rebase is a focused effort |
| Breakage of fork features | Medium | High | Post-rebase testing checklist; keep feature branches as backup |
| Upstream multi-root conflicts with ours | Medium | Medium | Review upstream's approach; may supersede or complement ours |
| `session-actions.ts` becomes unmergeable | Low | High | Understand upstream changes first (7+ commits); plan carefully |
| Tool rendering regressions | Low | Medium | Manual testing of invalid tool scenarios |

## Open Questions

1. Does upstream's multi-root workspace support (#1493) overlap with our `$body_` workaround and local SDK native field?
2. Did upstream's tool rendering refactoring change the code paths where our "invalid" tool rendering hooks in?
3. Are there upstream changes to the OpenCode SDK client that affect our local SDK alias?
4. Did upstream's `OpenChamberVisualSettings.tsx` rewrite preserve or supersede our feature flag UI?

---

**Related:**
- Findings: `~/.agent-sessions/26/06/12/260612-1423-upstream-branch-diff/findings.md`
- Session: `~/.agent-sessions/26/06/12/260612-1423-upstream-branch-diff/session.md`
- Fork features: [FEATURES.md](../FEATURES.md)
- Governance: [GOVERNANCE.md](../GOVERNANCE.md)
