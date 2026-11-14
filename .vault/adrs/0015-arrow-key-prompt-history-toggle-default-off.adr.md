---
type: adr
id: ADR-0015
title: "Composer Arrow-Key Prompt-History — Fork-Local Toggle, Default OFF"
status: accepted
createdAt: "2026-11-13T19:28:06Z"
updatedAt: "2026-11-13T19:28:06Z"
tags: [chat, composer, arrow-keys, settings, i18n, ui, fork-divergence]
supersedes: []
superseded_by: []
see_also:
  - "concepts/0006-chat-arrow-up-two-behaviors.concept.md"
  - "memories/0008-composer-ui-settings-zustand-persistence.memory.md"
  - "concepts/0003-upstream-divergence.concept.md"
---

# ADR-0015: Composer Arrow-Key Prompt-History — Fork-Local Toggle, Default OFF

## Context

Owner complaint 2026-11-13: pressing ArrowUp in the chat composer to reach the
start of a message replaces the draft with previous messages; requested a config
off-switch, or a removal plan for the web UI and VS Code extension.

Verified ground facts (session research + architect re-measurement at pin
`6d5e7b5c`, re-verified by the vault-keeper pass against the working tree):

- The recall is upstream's intentional feature: added in 1.6.5 (upstream PR #335,
  `ChatInput.tsx` ArrowUp/ArrowDown history branches), deliberately restricted in
  1.13.0, deliberately re-enabled in 1.13.3 (repo CHANGELOG entries verified).
  No config gate existed.
- One shared handler in `packages/ui` reaches all four runtimes (web, VS Code
  webview, desktop, mobile) — one change covers both requested surfaces.
- The repo's divergence posture (concept 0003-upstream-divergence; counts stale,
  principle current) prices local edits in `packages/ui`'s composer zone highly;
  the adjacent upstream issue openchamber/openchamber#4542 is moving
  transcript-side ArrowUp behavior toward standard semantics (status as of
  2026-11-13 — open/reopened, needs-discussion).

## Decision

1. **Toggle, not removal.** A fork-local Settings checkbox "Recall previous
   messages with arrow keys" (search id `chat.arrow-key-prompt-history`, store
   key `arrowKeyPromptHistoryEnabled`) gates the two history branches through the
   existing `canNavigateHistoryUp/Down` guard construction — the history blocks
   and `messageHistory` wiring stay byte-untouched. OFF ⇒ the key passes through
   to the CodeMirror `standardKeymap` (caret movement); ON ⇒ byte-for-byte
   upstream behavior.
2. **Fork default: OFF — owner-ruled** (dispatcher option "B", 2026-11-13,
   recorded verbatim in the working session's `session.md` §Owner Decision). The
   product default is owned by the fork; the code diff stays additive, so rebase
   posture is unaffected. Upgrade semantics: any user with no stored value moves
   from recall-on to recall-off; users who enable it store an explicit `true`.
   No migration writes a value.
3. **Persistence: zustand `useUIStore` partialize** (per browser profile), the
   exact mechanism class of its sibling `chat.persist-drafts` (same upstream
   PR); deliberately NOT `updateDesktopSettings` — see
   memory 0008-composer-ui-settings-zustand-persistence.
4. **Scope: composer only.** The transcript turn-scroll ArrowUp behavior is
   excluded (upstream #4542 territory); the two features are independent by
   construction. Full distinction:
   concept 0006-chat-arrow-up-two-behaviors.

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Unconditional removal of the history blocks | Fights a feature upstream re-enabled twice on purpose + likely collision with #4542 direction; orphans `useMessageHistory`(+test) and the `useUserMessageHistory` selector, turning a local edit into a sync-layer contract removal; guaranteed re-integration conflict in the fork's hottest file. Preserved verbatim with flip-triggers in the session decisions record. |
| Default ON (upstream parity) | The architect's working position in spec v1, explicitly overridden by the owner ruling; parity priced below fork-default control. |
| Wait for upstream / contribute upstream | #4542 concerns the transcript behavior, not the composer; no upstream disable-request exists. Kept as a companion option: the toggle diff is small and upstream-contributable. |

## Consequences

- Positive: the owner's complaint is fixed by default on all surfaces with one
  shared change; divergence stays additive and pattern-conformant (every edit
  mirrors its `chat.persist-drafts` sibling); retirement is localized — if
  upstream ships an equivalent toggle, retire the guard term + registration.
- Negative: intentional product-default divergence from upstream for fork users
  (owner-owned, changeloged); both changelog `[Unreleased]` bullets carry the
  default-change framing; rebase conflicts on the guard lines are
  by-construction but mechanically resolvable (keep upstream structure, keep
  the guard term).
- Neutral: the toggle is inert machinery when ON; the feature itself is unchanged.

## Feature state (as of 2026-11-13)

- Implemented in the working tree at `6d5e7b5c` (19 files + 1 new store test,
  +91/−4); reviewer round APPROVE with all automated gates re-run independently
  (full `packages/ui` suite 301/301, focused 13+4+4+5, workspace type-check 5/5
  exit 0). NOT committed — the working tree awaits the owner's commit; no agent
  committed anything. Live web-surface default-OFF behavior observed with
  screenshots; ON-live and VS Code/desktop/mobile runtime rows not run (spec
  matrix capped them; shared-code path reviewed at source).

## Verification (codebase)

Verified at the working tree on `6d5e7b5c` (scoped rg + exact-line reads,
2026-11-13 vault-keeper pass; Octocode tool sandbox does not cover
`/Volumes/Data`):

- `useUIStore.ts` — `arrowKeyPromptHistoryEnabled` field `:779`, initializer
  `false` `:1140`, setter `:2371`, `partialize` entry `:2788`.
- `ChatInput.tsx` — selector `:405`; both guards `:1591–1592` carry
  `arrowKeyPromptHistoryEnabled &&`; history blocks `:1637–1653` unchanged;
  autocomplete Arrow handling untouched.
- `search.ts` — registry entry `chat.arrow-key-prompt-history` `:337`.
- i18n — the three keys present in all 11 dictionaries.
- `CHANGELOG.md:14` and `packages/vscode/CHANGELOG.md:7` — the default-change
  bullets, setting name byte-matching the shipped en label.
