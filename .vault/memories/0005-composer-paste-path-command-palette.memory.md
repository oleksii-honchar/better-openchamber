---
type: memory
title: "Composer command palette no longer opens on pasted filesystem paths"
createdAt: "2026-09-02T15:49:08Z"
updatedAt: "2026-09-02T16:05:00Z"
tags: [composer, chat-input, command-palette, paste, path, triggers, ui]
see_also: []
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: Composer command palette no longer opens on pasted filesystem paths

## Fact

Pasting an absolute filesystem path as the first content of a chat message (e.g.
`/Users/tuiteraz/Downloads/jvastai_root.cer`) used to open the composer's command
palette, because any leading `/` was treated as a command trigger. Fixed in
`packages/ui/src/components/chat/composer/language/triggers.ts`:

- `matchCommandPalette` now returns `null` when the leading `/` token (up to the first
  space or newline) itself contains another `/`, i.e.
  `const query = value.substring(1, commandEnd); if (query.includes('/')) return null;`.
- This is a **path-shape** rule, not a paste rule: it covers pasted absolute paths
  (`/Users/...`) AND pasted or typed leading-slash paths (`/src/foo.ts`, `/usr/local/bin`).
- Typed commands (`/review`, `/init`) are single tokens and still open the palette —
  unchanged. A bare `/` also still opens the palette.

## Context

The composer routes picker decisions through the pure function
`resolveAutocompleteTrigger` (`.../composer/language/triggers.ts`).

**Gotcha that broke the first fix attempt:** an earlier version gated on
`inputSource === 'paste'`, but `ChatInput.handleComposerChange` only sets
`inputSource: 'paste'` when the pasted text contains `@` (or an image-paste suppression
flag). A plain path paste has no `@`, so `inputSource` was `'manual'` and the guard
never fired. Unit tests passed only because they manually supplied `inputSource: 'paste'`.
The shape rule avoids this entirely by not depending on paste plumbing.

Regression tests in `__tests__/triggers.test.ts`:
- pasted absolute path -> no picker;
- pasted relative slash path (`/src/foo.ts`) -> no picker;
- typed absolute path (`/usr/local/bin`) -> no picker (shape, not paste);

## Impact

- User-visible: pasting paths (e.g. from Finder/Downloads) no longer pops the
  command palette over the new message; the path lands as plain content.
- Risk considered and accepted: a leading `/` token that contains a `/` (e.g. a typed
  `/usr/local/bin`) is treated as a path and never opens the palette. Commands are
  single tokens, so no real command is affected.
- Shared pure UI logic; applies across web/Electron/VS Code/mobile with no runtime
  adapter changes.