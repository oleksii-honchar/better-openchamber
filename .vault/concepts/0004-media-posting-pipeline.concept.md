---
type: concept
title: "Media Posting Pipeline"
createdAt: "2026-09-03T12:50:00Z"
updatedAt: "2026-09-03T12:50:00Z"
tags: [media, chat, pipeline, renderer, grants, security]
see_also:
  - "adrs/0011-generalize-markdown-grant-route.adr.md"
  - "adrs/0012-vscode-temp-dir-media-grant-forwarding.adr.md"
  - "adrs/0013-shared-media-caps-and-signatures.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Concept: Media Posting Pipeline

## What

How media (images, videos, audio, gifs) flows from agent output into the chat UI: emitted as
`FilePart` with media MIME, rendered via the generalized markdown grant route + gallery/
FileAttachment players, with shared caps and container-signature validation at both grant and
renderer, and path-bound temp-dir grants for VS Code.

## Why

Agents post media; the UI must render it safely and consistently without widening the privilege
boundary or adding a new part model.

## Key Details

- **Transport:** `FilePart {type:"file", mime, url, filename}` — no new part type.
- **Authority/containment:** assistant text `markdownImageSources`; `approvedTempRoot`
  (`os.tmpdir()/opencode`); symlink realpath checks; path-bound `outsideFileGrant`.
- **Validation:** media MIME set + size caps (image 10 / video 50 / audio 20 MiB) + container
  signatures (ftyp/EBML/ID3/RIFF-WAVE) at grant + renderer.
- **VS Code:** forwarded path-bound grants for temp-dir sources; `resolveFileReadPath` stays
  workspace-only.
- **Failure:** missing/too-large/unsupported-codec surface as failure UI, no crash.
