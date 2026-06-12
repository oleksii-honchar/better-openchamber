# better-openchamber Governance

Procedures for maintaining `better-openchamber` — syncing with upstream via rebase, feature branching, VSIX builds, conflict resolution priorities, and preserving fork-specific features.

For overview, see [BETTER-OPENCHAMBER.md](./BETTER-OPENCHAMBER.md).

---

## Fork Structure

```
upstream/btriapitsyn/openchamber
└── main
    │
    ▼ fork (oleksii-honchar/better-openchamber)
    └── patched/main              ← Working branch (4 commits ahead, 197 behind)
        ├── feat-01               ← Feature branches (merged)
        ├── fix/invalid-tool-log  ← Fix branch (merged)
        └── <new-feature>         ← Branch off patched/main, rebase before merge
```

**Key rules:**

- **`patched/main`** — Working branch containing all fork features + synced with upstream via rebase. DO NOT merge into this branch — rebase onto it.
- **`main`** — May track upstream/main (could be behind; `patched/main` is the active branch).
- **Feature branches** — Branch off `patched/main`, rebase onto it before merge.
- **`origin`** — `git@github.com:oleksii-honchar/better-openchamber.git` (push target)
- **`upstream`** — `https://github.com/btriapitsyn/openchamber.git` (read-only fetch)

---

## Core Principle: Preserve Fork Features

When resolving conflicts between our fork code and upstream changes:

1. **Always preserve our fork logic** — If a conflict exists, our features win
2. **Adapt to upstream structural changes** — If upstream changed APIs or patterns, adapt our code while preserving behavior
3. **Never discard our feature flags** — Do NOT use `-X theirs` when feature flag code is involved
4. **If unsure, keep both temporarily** — Include both versions then dedupe manually; safer to fix twice than lose the feature

### Fork Features That Must Survive Every Rebase

1. **Feature flags system** (`useFeatureFlagsStore`, `featureFlags.ts`)
2. **Editable subagents** (`subagents.editable` in settings, ChatContainer.tsx logic)
3. **Multi-root workspace folders** (extension → webview → SDK → server chain)
4. **Invalid tool rendering** (5 tool rendering files)
5. **Local SDK path** (Vite alias in `vite.config.ts`)
6. **Better provider logos** (`useProviderLogo.ts`, `desktop.ts`)
7. **Fork documentation** (`docs/` directory)
8. **VSIX build script** (`scripts/build-vsix.sh`)
9. **Bun polyfills** (`bun-polyfills.ts`)
10. **Test setup** (`ChatContainer.test.tsx`, `test-setup.ts`)
11. **Folder-specific config** (`.opencode/openagent.json`)

---

## Rebasing with Upstream

### Before Rebasing: Assess Divergence

```bash
cd ~/www/misc/better-openchamber

# Fetch latest from both remotes
git fetch upstream main --quiet
git fetch origin --quiet

# Check divergence
echo "Commits behind upstream: $(git log --oneline patched/main..upstream/main | wc -l)"
echo "Commits ahead of upstream: $(git log --oneline upstream/main..patched/main | wc -l)"

# List our commits
git log --oneline upstream/main..patched/main

# Find merge base
git merge-base patched/main upstream/main
```

### Rebase Workflow

```bash
git checkout patched/main
git rebase upstream/main
```

If conflicts occur:

1. Open each conflicted file
2. **Keep our fork logic** — especially in feature flag, workspace folders, and tool rendering files
3. **Adapt to upstream's new types/APIs** if needed
4. `git add <resolved-file>`
5. `git rebase --continue`
6. Test thoroughly (build VSIX, install, verify features)

### Known Conflict Zones (from `patched/main` vs `upstream/main` analysis)

| File | Our Change | Upstream Changes | Resolution Strategy |
|------|-----------|-----------------|-------------------|
| `package.json` | Fork name, scripts, deps | 30+ upstream changes | Keep fork metadata + upstream deps |
| `OpenChamberVisualSettings.tsx` | Feature flag toggles | Multiple setting additions | Merge both sets of settings |
| `desktop.ts` | Provider logos | Electron refactoring | Add our logos to new structure |
| `client.ts` | SDK additions | Multiple SDK client changes | Merge both |
| `session-actions.ts` | workspaceFolders | Review flow, session share | Merge both; preserve workspaceFolders |
| `session-ui-store.ts` | workspaceFolders support | Multiple upstream changes | Merge both |
| `packages/vscode/*.ts` (3 providers) | workspaceFolders injection | Extension updates | Merge both |
| `webviewHtml.ts` + `webview/main.tsx` | workspaceFolders injection | Webview changes | Merge both |
| `packages/vscode/package.json` | Fork naming + VSIX config | Extension config | Keep fork naming |
| Tool rendering files (5) | `invalid` tool UI | Diagram editor, LSP output | Verify `invalid` still works |

### Post-Rebase Testing Checklist

- [ ] `subagents.editable: true` — subagent chats are editable
- [ ] `subagents.editable: false` — subagent chats are read-only
- [ ] Multi-root workspace shows all folders in `<env>` block
- [ ] Invalid tool calls show error UI
- [ ] VSIX builds successfully
- [ ] Provider logos render
- [ ] Feature flag defaults apply correctly
- [ ] `package.json` version is correct
- [ ] All translations load

---

## VSIX Build Workflow

### Quick Local Build

```bash
cd ~/www/misc/better-openchamber

./scripts/build-vsix.sh --vsix-version "1.12.4-local"
# Output: ~/Downloads/openchamber-1.12.4-local.xxx.vsix

code --install-extension ~/Downloads/openchamber-1.12.4-local.xxx.vsix
```

### Build with Custom Name

```bash
./scripts/build-vsix.sh --vsix-name testfork --vsix-version dev-abc123
# Temporarily sets version, builds, reverts
```

---

## Feature Branch Workflow

### Create Feature Branch

```bash
cd ~/www/misc/better-openchamber

git checkout patched/main
git pull origin patched/main

git checkout -b 260612-feat-<description>
```

### Work & Commit

```bash
# Make changes, then:
git add .
git commit -m "feat: <description>"
```

### Rebase Before Merge

```bash
git checkout patched/main
git pull origin patched/main

git checkout 260612-feat-<description>
git rebase patched/main

# Resolve conflicts preserving fork features
# Force-push if already on origin
git push origin 260612-feat-<description> --force-with-lease
```

### Merge Into patched/main

```bash
git checkout patched/main
git merge 260612-feat-<description> --no-ff
git push origin patched/main
```

---

## After Rebase: Working with Upstream's Multi-Root Support

Upstream v1.12.4 added multi-root VS Code workspace support (#1493, `f2874fbc`). Post-rebase:

1. **Review upstream's approach** — It may provide complementary or overlapping functionality
2. **Remove our `$body_` workaround** if upstream's approach covers it
3. **Keep our local SDK alias** — it has native `workspaceFolders` field
4. **Test both single-root and multi-root** workspaces

---

## VS Code Extension Development

### Build & Install Cycle

1. Make code change on feature branch
2. Build VSIX: `./scripts/build-vsix.sh --vsix-version "test-$(date +%s)"`
3. Install: `code --install-extension ~/Downloads/<file>.vsix --force`
4. Test in VsCode
5. Debug: Extension debug output in VSCode Developer Tools (Help → Toggle Developer Tools → Console)

### Settings Locations

- Settings UI: `OpenChamber` > `Features` > `Editable Subagents`
- Settings JSON: `"openchamber.subagents.editable": true`

---

## Recovery Scenarios

| Problem | Solution |
|---------|----------|
| Rebase conflict on patched/main | Resolve preserving fork features, `git rebase --continue` |
| Accidentally discarded feature flag code | Check `git reflog` or `git checkout -p HEAD~1` to recover |
| VSIX won't install | Use `code --install-extension <file>.vsix --force` |
| Rebase failed mid-way | `git rebase --abort`, reassess divergence, re-plan |

---

## Common Mistakes

- **Don't use `git merge upstream/main`** — Creates merge commits; prefer rebasing to keep clean "ours on top of theirs"
- **Don't discard fork features during conflict resolution** — Feature flag code is fragile; preserve it
- **Don't forget the post-rebase testing checklist** — 11 fork features to verify
- **Don't skip the upstream diff analysis** — Run a divergence check before every rebase
- **Don't ignore upstream's multi-root implementation** — v1.12.4 may have a better solution

---

## Branch Checklist

Before pushing to GitHub after rebase:

```bash
cd ~/www/misc/better-openchamber

# 1. Synced with upstream?
git fetch upstream main
echo "Behind: $(git log --oneline patched/main..upstream/main | wc -l)"

# 2. Builds successfully?
./scripts/build-vsix.sh --vsix-name test --vsix-version preflight

# 3. All docs updated?
ls docs/*.md && ls docs/spec/*.md

# 4. Fork features verified?
#   - Feature flags work
#   - Workspace folders work
#   - Invalid tool rendering works
#   - SDK alias is correct
```

---

**Last updated**: June 12, 2026 (rebase strategy for 4 commits, 197 commits behind)
