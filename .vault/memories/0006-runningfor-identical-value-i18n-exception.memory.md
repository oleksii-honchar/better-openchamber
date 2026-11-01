---
type: memory
title: "chat.statusRow.runningFor is deliberately byte-identical in all 11 dictionaries"
createdAt: "2026-10-31T18:59:10Z"
updatedAt: "2026-10-31T18:59:10Z"
tags: [i18n, locale, chat, elapsed, exception, owner-order]
see_also:
  - "adrs/0014-chat-turn-elapsed-line-running-only.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: `chat.statusRow.runningFor` — an intentional i18n exception

## Fact

The message key `chat.statusRow.runningFor` carries the byte-identical value `🕐 {duration}` in ALL
11 dictionaries (`de,en,es,fr,ja,ko,pl,pt-BR,uk,zh-CN,zh-TW`). This is a deliberate, owner-ordered
exception to the repo's translate-everything locale convention — not a lazy translation, and not to
be "fixed" by localization passes.

## Context

Owner copy instruction 2026-10-31 ("let's replace text with …"), resolved as one identical-value
complete-message key because its static text is an emoji and its placeholder is a pre-formatted
duration; the units themselves ARE translated, coming from the existing `common.duration.*` keys via
`formatSessionActivityDuration` (zero new unit keys, no concatenated units). A mechanical test and
parity tooling pins the 11× identity.

## Impact

Future contributors/parity tools must not localize this key or fold it into the per-locale
`activeFor`-style copy. A copy change is exactly one key value, flowed through one formatter call —
that is also the designed reversal path.
