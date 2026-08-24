---
type: adr
id: ADR-0004
title: "Use esbuildOptions.alias for SDK Pre-bundling"
status: accepted
createdAt: "2026-06-14T16:00:00Z"
updatedAt: "2026-06-14T16:00:00Z"
tags: [sdk, vite, esbuild, pre-bundling, workspace-folders]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0003-opencode-client-sdk.adr.md"
  - "memories/0002-local-sdk-alias.memory.md"
  - "memories/0004-session-actions-sdk-followup.memory.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0004: Use esbuildOptions.alias for SDK Pre-bundling

## Context

The VS Code webview build uses Vite to bundle the UI. The Vite alias in `packages/vscode/vite.config.ts` resolves `@opencode-ai/sdk/v2` to the local Better Open Code SDK (which includes native `workspaceFolders` support). However, `optimizeDeps.include: ['@opencode-ai/sdk/v2']` pre-bundles the npm SDK from `node_modules` before Vite's alias can resolve, causing the local SDK to be bypassed. The result: `workspaceFolders` is silently dropped from `session.create` because the npm SDK doesn't define this parameter.

## Decision

Use `esbuildOptions.alias` within `optimizeDeps` to force esbuild (Vite's pre-bundler) to resolve `@opencode-ai/sdk` to the local Better Open Code SDK:

```ts
optimizeDeps: {
  include: ['@opencode-ai/sdk/v2'],
  esbuildOptions: {
    alias: {
      '@opencode-ai/sdk': path.resolve(__dirname, '../../../better-opencode/packages/sdk/js/dist'),
    },
  },
},
```

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| **`esbuildOptions.alias`** (chosen) | Explicit, works at pre-bundling stage, preserves hot module reloading | Path is relative to the Vite config location | — |
| Remove `@opencode-ai/sdk/v2` from `optimizeDeps.include` | Simple, lets Vite alias handle resolution | SDK is a large dependency — cold-start issues in development without pre-bundling | Rejected |
| `optimizeDeps.exclude: ['@opencode-ai/sdk']` | Prevents pre-bundling of npm SDK | Same cold-start issues; SDK is imported in many places | Rejected |
| Hard-code absolute path in `resolve.alias` | More explicit than relative path | Less portable — breaks if the repo is moved | Rejected |
| Import from file path directly in source code | Most explicit | Would require changing all `@opencode-ai/sdk/v2` imports — too invasive | Rejected |

## Consequences

- **Positive:** The local Better Open Code SDK will be used for all SDK operations in the VS Code webview, restoring `workspaceFolders` support.
- **Positive:** Development cold-start time may improve slightly since the local SDK is already on disk (no network fetch for pre-bundling).
- **⚠️ Risk:** If the local SDK file path changes, the Vite config must be updated manually.
