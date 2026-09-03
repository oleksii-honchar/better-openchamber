---
type: index
title: "Architecture Decision Records"
createdAt: "2026-06-12T14:30:00Z"
updatedAt: "2026-08-24T09:10:00Z"
tags: []
---

# Architecture Decision Records

Architecture decisions for the better-openchamber fork, including forking strategy, the `patched/main2` rebuild, SDK integration, and UI rendering conventions. Dropped-feature ADRs (multi-root / workspace-folders / skip-workspace-prompt) are retained as superseded historical records.

## Nodes

### Fork & Rebuild
- [[0010-rebuild-patched-main2.adr]] — **ADR-0010 (accepted):** Rebuild `patched/main2` on latest upstream main (v1.20.0), keep only better-opencode integration features (F5, F6, F8, F12, F13); freeze `patched/main` as rollback
- [[0001-fork-divergence-and-rebase.adr]] — **ADR-0001 (superseded by ADR-0010):** Fork divergence state (4 ahead, 197 behind) and rebase strategy (rebase over merge, preserve fork features, commit-by-commit application)

### SDK & Workspace Integration
- [[0002-adapt-upstream-multi-root.adr]] — **ADR-0002 (superseded — dropped in patched/main2):** Adopt upstream's multi-root workspace approach with `WorkspaceFolderCandidate` type
- [[0003-opencode-client-sdk.adr]] — **ADR-0003 (accepted):** Use upstream's `opencodeClient` instead of fork's `sdk()` (deferred migration)
- [[0004-esbuild-options-alias-sdk.adr]] — **ADR-0004 (accepted):** Use `esbuildOptions.alias` to force Vite's pre-bundler to resolve the local Better Open Code SDK
- [[0005-validate-directory-before-sdk.adr]] — **ADR-0005 (accepted):** Validate `directory` before SDK call to prevent `?directory=undefined` IPC failure
- [[0006-extract-workspace-folders-paths.adr]] — **ADR-0006 (superseded — dropped in patched/main2):** Extract `path` from `WorkspaceFolderCandidate[]` for type-safe SDK integration
- [[0007-skip-workspace-prompt.adr]] — **ADR-0007 (superseded — dropped in patched/main2):** Add `skipWorkspacePrompt` boolean setting to auto-select first workspace folder instead of showing QuickPick

### UI & Rendering
- [[0008-tool-use-log-format.adr]] — **ADR-0008 (accepted):** Format `tool_use` collapsed headers as `Tool Use "<innerName>"` with unchanged `arrow-right` icon
- [[0009-rename-meta-tools.adr]] — **ADR-0009 (accepted):** Rename meta tools to meta_search/meta_use for log clarity

- [[0011-generalize-markdown-grant-route.adr.md]] — **ADR-0011 (accepted):** Generalize the markdown grant route instead of a parallel media route
- [[0012-vscode-temp-dir-media-grant-forwarding.adr.md]] — **ADR-0012 (accepted):** VS Code resolves temp-dir media via forwarded path-bound grants
- [[0013-shared-media-caps-and-signatures.adr.md]] — **ADR-0013 (accepted):** Shared media size caps + signature sniffing at grant + renderer
