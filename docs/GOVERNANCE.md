# better-openchamber Governance

VS Code extension fork procedures for maintaining `better-openchamber` — syncing with upstream, feature branching, VSIX builds, and preserving fork-specific escape hatches.

For overview, see [BETTER-OPENCHAMBER.md](./BETTER-OPENCHAMBER.md).

---

## Fork Structure

```
                      upstream/ahmedbouchakour1/openchamber
                      ┌───────────────────────────────────────┐
                      │  main (upstream default)              │◀── upstream target
                      └───────────────────────────────────────┘
                                │
                                │ fork
                                ▼
                oleksii-honchar/better-openchamber (origin)
                ┌────────────────────────────────────────────┐
                │  main (mirrors upstream/main)               │◀── kept current  
                │  patched/dev (working branch)               │◀── escapes + synced with upstream
                │  260518-feat-01, ...                         │◀── feature branches off patched/dev
                └────────────────────────────────────────────┘
```

**Key rules:**
- **`main`** — Mirrors upstream/main. Kept current via periodic sync and rebase  
- **`patched/dev`** — Working branch containing escape hatches + synced with upstream  
- **Feature branches** — Branch off `patched/dev`, rebase onto it before merge  
- **`origin`** — Your fork remote (push target)  
- **`upstream`** — Original repo read-only, never push here directly  

---

## Core Principle: Preserve Escape Hatches

When resolving conflicts between our feature code and upstream changes:

1. **Always preserve our escape hatch logic** — if a conflict exists between our changes and upstream changes, the fork's user-configurable overrides win  
2. **Adapt to upstream structural changes** — if upstream changed APIs or patterns (TypeScript interfaces, component props), adapt our code while preserving behavior  
3. **Never discard our settings toggles** — do NOT use `-X theirs` when `subagents.editable` feature flag code is involved  
4. **If unsure, keep both temporarily** — include both versions then dedupe manually; safer to fix twice than lose the escape

---

## Syncing with Upstream

**Before major changes, always sync first:**

```bash
cd ~/www/misc/better-openchamber

# 1. Fetch latest from both remotes  
git fetch upstream main --quiet
git fetch origin --quiet

# 2. Check divergence
git log --oneline patched/dev..upstream/main | wc -l  # commits behind
git log --oneline upstream/main..patched/dev | wc -l  # commits ahead  

# 3. Rebase patched/dev onto upstream/main  
git checkout patched/dev
git rebase upstream/main

# 4. If conflicts occur (resolve preserving our features):
#    - Open conflicted files, keep our escape logic, adapt to new types if needed
#    - git add <resolved-file>
#    - git rebase --continue
```

---

## VSIX Build Workflow

Unlike CLI forks that build binaries, this extension builds **VSIX packages** for immediate testing without upstream sync delays:

### Quick Local Build (Temporary Version)

```bash
cd ~/www/misc/better-openchamber

# Build with temp version suffix (doesn't dirty git)
./scripts/build-vsix.sh --vsix-version "1.11.2-local" 
# Output: ~/Downloads/openchamber-1.11.2-local.xxx.vsix

# Install into VSCode/VsCodium  
code --install-extension ~/Downloads/openchamber-1.11.2-local.xxx.vsix

# Verify
code --list-extensions --show-debug-with-bootloader  # should show local extension
```

### Dev Loop Without Committing Version Bumps

The build script temporarily sets `package.json` version, builds the VSIX, then reverts:

```bash
./scripts/build-vsix.sh --vsix-name testfork --vsix-version dev-abc123
# Temporarily sets package.json "version": "dev-abc123"  
# Outputs: ~/Downloads/testfork-dev-abc123.vsix
# Reverts version after build completes
```

---

## Feature Branch Workflow

### Create Feature Branch

```bash
cd ~/www/misc/better-openchamber

# Ensure patched/dev is current
git checkout patched/dev  
git pull origin patched/dev

# Create branch (YYYYMMDD-feat-X format)  
git checkout -b 260518-feat-01-editable-subagents
```

### Work & Commit

```bash
# Make changes (e.g., add subagents.editable flag to ChatContainer.tsx)
# ... edit files ...

git add .
git commit -m "feat: add subagents.editable feature flag to restore editable subtasks"
```

### Rebase Before Merge

Always rebase onto `patched/dev` before merging back to keep linear history:

```bash
# Make sure patched/dev is current
git checkout patched/dev  
git pull origin patched/dev

# Switch to feature and rebase
git checkout 260518-feat-01-editable-subagents
git rebase patched/dev

# Resolve conflicts preserving our escape logic (see Core Principle above)

# Force-push rebased branch  
git push origin 260518-feat-01-editable-subagents --force-with-lease
```

### Merge Into patched/dev

```bash
git checkout patched/dev
git merge 260518-feat-01-editable-subagents --no-ff  # preserve feature branch identity  
git push origin patched/dev
```

---

## Development with VSCode Extension

Unlike CLI mode (which uses `start-dev.sh` with Bun dev server), extension development requires building VSIXes for testing:

### Build & Install Cycle

1. **Make code change** (e.g., add env var check in ChatContainer.tsx)  
2. **Build VSIX**: `./scripts/build-vsix.sh --vsix-version "test-$(date +%s)"`
3. **Install**: `code --install-extension ~/Downloads/<file>.vsix`
4. **Test** in VsCode with subagent sessions open
5. **Debug**: Toggle flag in settings or env, verify read-only banner disappears when typing

### Settings Locations

User settings for testing escape hatches:
- `openchamber.subagents.editable: true` (if UI toggle implemented)  
- Or env var: `OPENCODE_SUBAGENTS_EDITABLE=true` before starting VSCode  

Extension debug output shows in VSCode Developer Tools (Help → Toggle Developer Tools → Console).

---

## Recovery Scenarios

| Problem | Solution |
|---------|----------|
| Rebase conflict on patched/dev | Resolve preserving escape code, run `git rebase --continue` |
| Accidentally discarded feature flag code | Check `git reflog` or `git checkout -p HEAD~1 packages/ui/src/...` to recover |
| VSIX won't install (version conflict) | Use `--force` with `code --install-extension <file>.vsix --force`, or increment version in `package.json` manually before building again |

---

## Common Mistakes

- **Don't push feature branches without rebasing first** — Always rebase onto patched/dev to preserve linear history  
- **Don't use `git merge upstream/main` into patched/dev** — This creates a merge commit; prefer rebasing (`git rebase upstream/main`) to keep clean "ours on top of theirs" semantics
- **Don't forget the extension build cycle differs from CLI** — No Bun dev server for the extension itself (that's Opencode CLI); VSIX builds are the loop  
- **Don't ignore spec documents** — Each feature must have a spec in `docs/spec/` before implementation starts

---

## Branch Checklist

Before pushing to GitHub:

```bash
cd ~/www/misc/better-openchamber

# 1. Synced?
git fetch upstream main && git log --oneline patched/dev..upstream/main | head -5

# 2. Rebases cleanly?
git checkout <feature-branch>
git rebase -s origin/patched/dev  # -s to interactively squash if needed

# 3. Docs updated?  
ls docs/spec/<feat>-*.md && grep -q "Status: ⏳ In-flight" docs/FEATURES.md

# 4. VSIX builds successfully?
./scripts/build-vsix.sh --vsix-name test --vsix-version preflight
```

---

**Last updated**: May 18, 2026 (v1.11.1 read-only escape hatch design)
