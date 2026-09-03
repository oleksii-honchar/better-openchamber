---
type: adr
id: ADR-0011
title: "Generalize the Markdown Grant Route Instead of a Parallel Media Route"
status: accepted
createdAt: "2026-09-03T12:50:00Z"
updatedAt: "2026-09-03T12:50:00Z"
tags: [media, grants, security, markdown, fs]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0012-vscode-temp-dir-media-grant-forwarding.adr.md"
  - "adrs/0013-shared-media-caps-and-signatures.adr.md"
  - "concepts/0004-media-posting-pipeline.concept.md"
---

# ADR-0011: Generalize the Markdown Grant Route

## Context

One existing route (`/api/openchamber/sessions/:id/markdown-image-grants`) already owns
authority (`markdownImageSources`), containment (`approvedTempRoot`), symlink realpath checks,
and path-bound `outsideFileGrant` reuse. A parallel media route would duplicate all of that.

## Decision

Generalize the route's `inspectImage`/`hasImageSignature` to media MIME + size caps + container
signatures (`KIND_BY_EXTENSION`, `hasMediaSignatureForKind`). Keep its authority/containment/
grant mechanics unchanged; reuse `/api/fs/raw` + `outsideFileGrant` rendering.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| Parallel `/markdown-media-grants` route | Clean separation | Duplicates authority + containment + grant lifecycle | No new surface needed; one route owns the mechanics |

## Consequences

- **Positive:** no new attack surface; existing authority/containment preserved.
- **Negative:** route has a broader media signature surface (mitigated by shared caps/signatures).
- **Neutral:** route rename (image→media) is cosmetic; caller path unchanged.

## Verification (codebase)

- `packages/web/server/lib/markdown-image-grants/routes.js` — `hasMediaSignatureForKind`
  (image + video `ftyp` at offset 4 + `EBML` webm + audio `ID3`/`RIFF....WAVE`), media caps in
  `MARKDOWN_MEDIA_MAX_BYTES`, `approvedTempRoot` containment, `MAX_IMAGE_SOURCES = 12`.
- m4a `ftyp` branch verified (reviewer Issue #1 fix).
