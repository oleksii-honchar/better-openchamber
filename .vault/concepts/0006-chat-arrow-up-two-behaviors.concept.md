---
type: concept
title: "Chat ArrowUp — Two Different Behaviors (Composer Recall vs Transcript Turn-Scroll)"
createdAt: "2026-11-13T19:28:06Z"
updatedAt: "2026-11-13T19:28:06Z"
tags: [chat, composer, arrow-keys, upstream, triage]
see_also:
  - "adrs/0015-arrow-key-prompt-history-toggle-default-off.adr.md"
  - "concepts/0003-upstream-divergence.concept.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Concept: Chat ArrowUp — Two Different Behaviors

## What

"ArrowUp shows previous messages" is TWO unrelated features that users describe
identically:

- **Composer prompt-history recall:** in the chat input, ArrowUp with an empty
  draft or caret at offset 0 replaces the draft with an earlier user message of
  the session. Lives in `packages/ui/src/components/chat/ChatInput.tsx`
  (`canNavigateHistory*` guards + history branches in `handleKeyDown`), fed by
  `useMessageHistory`/`useUserMessageHistory`. In this fork it is gated OFF by
  default via the "Recall previous messages with arrow keys" setting
  (ADR-0015).
- **Transcript turn-by-turn scroll:** with focus inside the chat scroll
  container and OUTSIDE inputs, unmodified ArrowUp/Down jumps the viewport one
  message. Lives in `packages/ui/src/components/chat/ChatContainer.tsx`
  (window keydown → `scrollByTurnOffset`), guard selector excludes
  `input, textarea, [contenteditable="true"]` so it never fires while typing.

## Why

Triage and design must not mix them: the composer feature is this fork's owned
toggle (ADR-0015); the transcript behavior is upstream
openchamber/openchamber#4542 (needs-discussion; proposes browser-like pixel
scrolling + modifier-key turn jumps) and must stay deferred to whatever
upstream decides. One consumes composer keys, the other is a window listener
guarded away from inputs — they cannot interact.

## Key Details

- **Distinguishing test:** type a draft, press Home then Up → draft replaced =
  composer recall. Click in the transcript (not the input), press Up → viewport
  jumps = turn-scroll.
- **Composer feature provenance (verified in repo CHANGELOG):** added 1.6.5
  (upstream PR #335, with the draft-persistence sibling setting), restricted
  1.13.0 ("moves the cursor inside multi-line drafts again"), re-enabled 1.13.3
  ("opens prompt history again when the cursor is at the start"). A
  twice-litigated product decision — treat "just remove it" proposals against
  this history.
- Both surfaces reach web, VS Code extension, desktop and mobile through the one
  shared `packages/ui` tree; any future change here is one shared change.
