---
type: runbook
title: "Rebase better-openchamber onto Upstream"
createdAt: "2026-06-12T14:35:00Z"
updatedAt: "2026-06-12T14:35:00Z"
tags: [fork, rebase, operations]
see_also:
  - "adrs/0001-fork-divergence-and-rebase.adr.md"
  - "concepts/0003-upstream-divergence.concept.md"
  - "memories/0001-npm-sdk-body-prefix-workaround.memory.md"
  - "memories/0002-local-sdk-alias.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Runbook: Rebase better-openchamber onto Upstream

## Prerequisites

- Git repository at `~/www/misc/better-openchamber` with `origin` and `upstream` remotes configured
- Clean working tree (`git status` is clean)
- Understanding of the 4 fork commits and 11 fork features (see concept `upstream-divergence`)
- Time: estimated 2-4 hours for full rebase + testing

## Steps

### Phase 1: Pre-Rebase Assessment

1. `cd ~/www/misc/better-openchamber`
2. `git fetch upstream main --quiet`
3. `git fetch origin --quiet`
4. Check divergence:
   ```bash
   echo "Behind: $(git log --oneline patched/main..upstream/main | wc -l)"
   echo "Ahead: $(git log --oneline upstream/main..patched/main | wc -l)"
   ```
5. Confirm all 4 commits present: `git log --oneline upstream/main..patched/main`
6. Record merge base: `git merge-base patched/main upstream/main`
7. Create backup branch: `git branch backup/pre-rebase-$(date +%Y%m%d) patched/main`

### Phase 2: Rebase

1. `git checkout patched/main`
2. `git rebase upstream/main`
3. **First conflict (commit 1 — `00cc7423` chore: fork setup):**
   - Resolve ~13 conflicting files:
     - `package.json` — Keep fork metadata (name, version) + merge upstream deps
     - `OpenChamberVisualSettings.tsx` — Keep feature flag toggles, adapt to new component structure
     - `desktop.ts` — Add provider logos to upstream's new desktop structure
     - `client.ts` — Merge both SDK client additions
     - `session-actions.ts` — **Most critical** — preserve workspaceFolders, adapt to upstream's review flow
     - `session-ui-store.ts` — Preserve workspaceFolders, merge upstream changes
     - 3 VS Code providers — Preserve workspaceFolders injection, merge extension updates
     - `webviewHtml.ts` + `webview/main.tsx` — Merge both webview changes
     - `packages/vscode/package.json` — Keep fork naming + VSIX config
     - `desktop.d.ts` — Likely auto-merges cleanly
   - After each file: `git add <file>`
   - `git rebase --continue`
4. **Second conflict (commit 2 — `fb4696ce` docs):** Trivial — docs only, no code conflicts expected.
5. **Third conflict (commit 3 — `b349078b` tool cal fixes):**
   - 5 tool rendering files — likely auto-merged, but verify runtime behavior
   - `ToolPart.tsx` — **Medium risk** — upstream added diagram editor, LSP output, Electron support near our changes
   - `git add <file>` for each, `git rebase --continue`
6. **Fourth conflict (commit 4 — `064b6858` SDK alias):**
   - `vite.config.ts` — Low risk, isolated change
   - `session-actions.ts` — **Medium risk** — verify `$body_` workaround removal is correct against upstream's version

### Phase 3: Failed Rebase Recovery

If rebase fails irrecoverably:
- `git rebase --abort`
- Review upstream changes first: `git log --oneline patched/main..upstream/main`
- Consider splitting commit 1 into smaller rebase-friendly commits
- Try interactive rebase to reorder or squash

### Phase 4: Post-Rebase Verification

Test each fork feature:

| Feature | How to Verify |
|---------|--------------|
| Feature flags | Toggle `subagents.editable` in settings, verify behavior change |
| Editable subagents | Open subagent session, verify it's editable (default: true) |
| Multi-root folders | Open multi-root workspace, check `<env>` prompt for all folders |
| Invalid tool rendering | Trigger undefined tool call, verify red border + error message |
| SDK alias | Check Vite resolves to `better-opencode/packages/sdk` |
| Provider logos | Verify all provider logos render correctly |
| VSIX build | Run `scripts/build-vsix.sh` — must complete without errors |
| Translations | Check all locale files load, no missing keys |
| Test setup | Run `ChatContainer.test.tsx` if test runner is configured |

### Phase 5: Push

1. If rebase is clean: `git push origin patched/main --force-with-lease`
2. Update `main` branch to match upstream: `git checkout main && git merge upstream/main && git push origin main`

## Verification

- [ ] `git log --oneline patched/main ^upstream/main` shows exactly 4 commits (our commits on top)
- [ ] `git log --oneline upstream/main..patched/main` shows only our 4 commits
- [ ] All 11 fork features verified working
- [ ] VSIX builds successfully
- [ ] `patched/main` is ahead of `upstream/main` by exactly 4 commits

## Rollback

If post-rebase testing reveals issues:
- `git checkout patched/main`
- `git reset --hard backup/pre-rebase-<date>`
- Or: `git push origin backup/pre-rebase-<date>:patched/main --force`
