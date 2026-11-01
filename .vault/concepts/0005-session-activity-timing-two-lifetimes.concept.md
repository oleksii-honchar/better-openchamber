---
type: concept
title: "Session Activity Timing — One Owner, Two Lifetimes"
createdAt: "2026-10-31T18:59:10Z"
updatedAt: "2026-10-31T18:59:10Z"
tags: [sync, timing, provenance, chat, sidebar, turn-lifecycle]
see_also:
  - "adrs/0014-chat-turn-elapsed-line-running-only.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Concept: Session Activity Timing — One Owner, Two Lifetimes

## What

`packages/ui/src/sync/session-activity-timing.ts` is the single client-side owner of "is a turn
running and since when". It keeps one owned state (`startedAt`, `settledMs`, `unknownStarts`) fed
from the shared session-status channel and serves TWO deliberately different lifetimes over it:

- **Settled lifetime (sidebar):** counts from observation, deliberately hides on the session the
  user is watching, converts to a finished duration at settle, shown while unread.
- **Running-only lifetime (chat composer `🕐` line):** exists while and only while the turn runs
  WITH AN OBSERVED start; ends with the turn; no settled tail.

## Why

"A counter exists" and "this client watched the turn begin" are different facts. Reconciling them in
one owner prevents the drift classes that per-surface stamping produces: re-published `busy` events
(the server re-emits them every agent step) re-stamping the start, and mid-turn joins inventing a
zero. Honesty rule across readers: unknown answers as unknown (`undefined`/`false`), never a
fabricated value; surfaces render the unknown as the bare working affordance.

## Key Details

- **Provenance set:** `unknownStarts` mirrors exactly those `startedAt` entries whose start was
  minted from a status *snapshot* (client joined mid-turn). An `active` event's first observation is
  a real transition edge → known; adopting a persisted record (a previous page watched the start) →
  known. Membership is mechanical with the record's lifetime.
- **Provenance never changes `startedAt`:** settled readers keep counting from observation exactly
  as before; only running-only readers consult the gate (`useSessionActivityObservedStartAt`,
  `useHasSessionActivityRunningDuration`).
- **Turn end:** the one-shot idle/error event edge (a snapshot's silence is NOT proof of end);
  only a stamp expires a persisted start.
- **Elapsed values are never stored:** leaves compute `now − start` from their own 1 fps shared
  ticker; the store holds anchors only.
- The elapsed-line feature is a consumer decision, not part of this concept (ADR-0014); this concept
  is what makes any such consumer cheap and honest.
- The operational detail carrier lives beside the code: `packages/ui/src/sync/DOCUMENTATION.md`.
