---
type: adr
id: ADR-0013
title: "Shared Media Size Caps + Signature Sniffing at Grant and Renderer"
status: accepted
createdAt: "2026-09-03T12:50:00Z"
updatedAt: "2026-09-03T12:50:00Z"
tags: [media, cap, signature, renderer, grants]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0011-generalize-markdown-grant-route.adr.md"
  - "concepts/0004-media-posting-pipeline.concept.md"
---

# ADR-0013: Shared Media Size Caps + Signature Sniffing

## Context

Videos are large (tens of MB); grant and renderer must agree on limits and failure states.

## Decision

Defaults: image 10 MiB, video 50 MiB, audio 20 MiB. Validate independently at the grant route
(stat + signature) and renderer (content-length/size + signature, data-URL length). Missing /
too-large / unsupported-codec states surface as failure UI (no crash).

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| Transcode-to-fit | Smaller payloads | ffmpeg/wasm dep, out of scope | Follow-up |
| Unbounded uploads | Simple | Resource risk | Rejected |

## Consequences

- **Positive:** consistent failure states; no crash; bounded resource use.
- **Negative:** some large videos rejected (documented cap).
- **Neutral:** shared `MARKDOWN_MEDIA_MAX_BYTES` keyed by kind exported from renderer + grant.

## Verification (codebase)

- Renderer `markdownImageAssets.ts` — `SUPPORTED_MEDIA_MIME_TYPES`, `MARKDOWN_MEDIA_MAX_BYTES`
  (image/video/audio caps), signature sniffing (RIFF/WEBP, ftyp, EBML, ID3, RIFF/WAVE).
- Grant route shares the same caps (`MARKDOWN_MEDIA_MAX_BYTES` imported/defined) + signatures.
