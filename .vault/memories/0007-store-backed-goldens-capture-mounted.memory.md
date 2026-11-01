---
type: memory
title: "Store-backed render goldens must be captured through a mounted path (static render sees only the initial store snapshot)"
createdAt: "2026-10-31T18:59:10Z"
updatedAt: "2026-10-31T18:59:10Z"
tags: [testing, goldens, store, renderToStaticMarkup, chat, composer]
see_also:
  - "adrs/0014-chat-turn-elapsed-line-running-only.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: store-backed goldens capture mounted, not server-rendered

## Fact

`renderToStaticMarkup` (and server/static render shortcuts in general) reads only the store's INITIAL
snapshot — a store-driven render captured that way can silently record empty/stale state. Any golden
or fixture covering store-backed UI must be captured through a MOUNTED path.

## Context

Caught while testing the chat running-elapsed line (2026-10-31): the default-OFF containment golden
for `ComposerFooter` in the shipped suite is captured from the PRISTINE pre-feature component through
the mounted fixture DOM (`runningElapsedFooterHarness.test-utils.tsx`, deterministic tree serializer;
byte-verified temporary `git show` swap of the pre-change file). Flag raised by the worker at T3,
ruled by the developer, and honored again by the T4 fixture-walk test. The rule is now written in
`packages/ui/src/components/chat/composer/DOCUMENTATION.md` §Testing.

## Impact

Regenerating `runningElapsedFooterGolden.json` legitimately means re-capture from the PRE-change
implementation — never from the current one. Future store-driven UI tests in this repo must mount;
do not trust static-render goldens for any stateful surface (this generalizes beyond the composer).
