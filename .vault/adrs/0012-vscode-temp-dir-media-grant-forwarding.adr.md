---
type: adr
id: ADR-0012
title: "VS Code Resolves Temp-Dir Media via Forwarded Path-Bound Grants (Not Widened Local Bridge)"
status: accepted
createdAt: "2026-09-03T12:50:00Z"
updatedAt: "2026-09-03T12:50:00Z"
tags: [media, vscode, grants, security, temp-dir]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0011-generalize-markdown-grant-route.adr.md"
  - "concepts/0004-media-posting-pipeline.concept.md"
---

# ADR-0012: VS Code Temp-Dir Media via Forwarded Path-Bound Grants

## Context

`bridge-localfs-proxy-runtime.ts` returned 501 for the grants route; `resolveFileReadPath` is
workspace-only (403 outside). OpenCode temp dir is `os.tmpdir()/opencode` — non-workspace by
design.

## Decision

Replace the grants 501 with a forwarding/local-resolution path for sources under
`approvedTempRoot`, reusing the local fs bridge for workspace paths and minting a path-bound
temp-dir grant for outside-workspace. `resolveFileReadPath` stays workspace-only; the privilege
boundary is the bridge, not the renderer.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| Allow local fs bridge to read any temp-dir path | Simpler | Renderer-side visibility ≠ authorization; widens bridge | HIGH security/privacy; bridge stays narrowed |

## Consequences

- **Positive:** VS Code renders temp-dir media; privilege boundary preserved.
- **Negative:** path-bound grant minting adds complexity.
- **Neutral:** `resolveFileReadPath` untouched (stays workspace-only).

## Verification (codebase)

- `packages/vscode/src/bridge-localfs-proxy-runtime.ts` — `approvedTempRoot = os.tmpdir()/opencode`;
  grants route regex handles `/markdown-image-grants`; temp-dir sources forwarded via path-bound
  grant scoped to `approvedTempRoot`; `resolveFileReadPath` workspace-only.
