# Markdown Image Grants

## Purpose

This module lets the Markdown media gallery display media (images, video, and
audio) that an assistant explicitly referenced from any absolute local path when
the UI is on a different machine.

## Contract

- Chat Markdown rendering is independent: assistant image syntax renders as an
  icon and filename, while the gallery only reads finalized Markdown to collect
  image candidates.
- `POST /api/openchamber/sessions/:sessionId/markdown-image-grants` prepares up to 12
  local media sources (images, video, audio) in one message-level request. The
  server fetches the assistant message once and verifies every exact source
  before reading files.
- Authorization recognizes the same common inline and reference-style image
  destinations collected by the UI, including balanced parentheses, while
  excluding fenced and inline code.
- Relative and workspace-contained absolute paths resolve against the active
  directory. Any absolute local path is accepted after `realpath` resolution for
  all media kinds (image/video/audio): the route is always-relaxed (ADR-1, no
  env flag). Each accepted file still receives a path-bound, time-boxed grant with
  the 10-minute `OUTSIDE_FILE_GRANT_TTL_MS` lifetime and exact-canonical-path
  matching. The assistant-text authority gate still applies: a source not
  referenced by the assistant message returns `{ status: 'error' }`.
- Media files are container-signature-checked by kind and limited by per-kind
  size caps: images (PNG, JPEG, GIF, WebP) to 10 MiB, video (MP4, WebM) to
  50 MiB, and audio (MP3, WAV, M4A) to 20 MiB.
- Prepare requests inspect only file metadata and signatures. Workspace images
  reuse the existing authenticated `/api/fs/raw` asset route directly. Images
  under `os.tmpdir()/opencode` receive the existing path-bound `raw`
  `outsideFileGrant`; this module does not add another asset lifetime, copy, or
  storage layer. Missing files return per-source results so the gallery can
  remove only those items.

The routes are OpenChamber-owned and must be registered before the generic
OpenCode proxy. Web, Electron, hosted mobile, and Capacitor use the shared
server implementation. VS Code does not call this route for workspace media;
those use its local filesystem bridge. For media that needs a grant, VS Code
forwards the request to the OpenCode server's grants route, which mints the
path-bound grant.
