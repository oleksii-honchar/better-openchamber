---
type: index
title: "Architecture Decision Records"
createdAt: "2026-06-12T14:30:00Z"
updatedAt: "2026-06-14T16:00:00Z"
tags: []
---

# Architecture Decision Records

Architecture decisions for the better-openchamber fork, including forking strategy, feature flag architecture, workspace folder approach, tool rendering decisions, and SDK integration.

## Nodes

### Fork & Rebase
- [[0001-fork-divergence-and-rebase.adr]] — **ADR-0001 (accepted):** Fork divergence state (4 ahead, 197 behind) and rebase strategy (rebase over merge, preserve fork features, commit-by-commit application)

### SDK & Workspace Integration
- [[0002-adapt-upstream-multi-root.adr]] — **ADR-0002 (accepted):** Adopt upstream's multi-root workspace approach with `WorkspaceFolderCandidate` type
- [[0003-opencode-client-sdk.adr]] — **ADR-0003 (accepted):** Use upstream's `opencodeClient` instead of fork's `sdk()` (deferred migration)
- [[0004-esbuild-options-alias-sdk.adr]] — **ADR-0004 (accepted):** Use `esbuildOptions.alias` to force Vite's pre-bundler to resolve the local Better Open Code SDK
- [[0005-validate-directory-before-sdk.adr]] — **ADR-0005 (accepted):** Validate `directory` before SDK call to prevent `?directory=undefined` IPC failure
- [[0006-extract-workspace-folders-paths.adr]] — **ADR-0006 (accepted):** Extract `path` from `WorkspaceFolderCandidate[]` for type-safe SDK integration
- [[0007-skip-workspace-prompt.adr]] — **ADR-0007 (accepted):** Add `skipWorkspacePrompt` boolean setting to auto-select first workspace folder instead of showing QuickPick
