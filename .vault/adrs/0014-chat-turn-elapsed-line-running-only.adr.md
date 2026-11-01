---
type: adr
id: ADR-0014
title: "Chat Turn-Elapsed Line — In-Owner Running-Only Derivation, Default-OFF Surface Containment"
status: accepted
createdAt: "2026-10-31T18:59:10Z"
updatedAt: "2026-10-31T18:59:10Z"
tags: [chat, composer, timer, elapsed, sync, i18n, ui]
supersedes: []
superseded_by: []
see_also:
  - "concepts/0005-session-activity-timing-two-lifetimes.concept.md"
  - "memories/0006-runningfor-identical-value-i18n-exception.memory.md"
  - "memories/0007-store-backed-goldens-capture-mounted.memory.md"
---

# ADR-0014: Chat Turn-Elapsed Line — In-Owner Running-Only Derivation

## Context

Owner asked for a chamber-style elapsed-time indicator for a running assistant turn, including the
engine boot-preparation window, specifically on the webui chat and the VS Code extension chat
("we don't care about tui - only openchamber vscode extension chat and webui", 2026-10-31).

Verified ground facts:

- **M9 (shared tree):** both named surfaces render ONE chat component tree — webui
  `App`/`MainLayout` and extension `VSCodeApp`/`VSCodeLayout` mount the same
  `ChatView → ChatContainer → ChatInput → ComposerFooter` chain (`packages/vscode` consumes
  `@openchamber/ui@workspace:*`). One authored changeset in `packages/ui` covers both.
- The chat pane had no turn-level timer for any phase. The sidebar's duration counter cannot answer
  the owner's case: its documented rule never lets it linger on the session being watched.
- Settled code archaeology to honor: `faa9c243` (measured animation→text-swap performance lesson),
  `84a457dd` (hover-only finished-turn timestamps), the minimized `WorkingPlaceholder` state machine.
- The whole-line decision (lanes across better-openchamber / better-opencode / TUI, and keeping
  persona-boot and the coach untouched) lives in the working session's decision record (ADR-19 +
  addenda); this ADR records this repository's slice.

## Decision

1. **One owner, one derivation.** The turn-timing state in
   `packages/ui/src/sync/session-activity-timing.ts` is extended IN-OWNER with a running-only
   lifetime over the same store: `useSessionActivityObservedStartAt` /
   `useHasSessionActivityRunningDuration`, gated by a new `unknownStarts` provenance set.
   Invariants: the idle→busy (first-busy) transition stamps the start; a re-published busy NEVER
   re-stamps; a start minted from a status snapshot stays UNKNOWN (running-only readers answer
   unknown — never a fabricated zero); `session.idle` / `session.error` clear the value one-shot.
   Settled-duration (sidebar) consumers are byte-unchanged. No second derivation owner.
2. **Surface containment (D-5).** `ChatTurnElapsedLine` mounts inside `ComposerFooter`'s
   working/stop cluster, presented only through the explicit `runningElapsedVisible` prop that
   defaults **OFF** at every hop (ChatView → ChatContainer → ChatInput → ComposerFooter) and is
   enabled ONLY at the `MainLayout` (×2) and `VSCodeLayout` (×3) `ChatView` mounts. Mobile app,
   electron mini-chat and the embedded panel are untouched. Enabling another surface later is one
   prop at that root.
3. **Cost discipline.** One 1 fps text swap per visible session via the shared duration-ticker
   channel (`useDurationTickerNow`, `TICK_MS = 1000`), leaf-mounted; zero animation, zero new
   timer state in `WorkingPlaceholder`.
4. **Copy.** ONE complete-message key `chat.statusRow.runningFor` with the byte-identical value
   `🕐 {duration}` in all 11 dictionaries (deliberate, owner-ordered — see memory 0006); the
   duration comes from the existing translated-unit formatter `formatSessionActivityDuration`;
   zero new unit keys, no concatenated units anywhere.

Zero new producer surfaces: no protocol/server event, no config key, no store/schema addition beyond
this module's private state. Code changes were confined to `packages/ui` by design.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| Second start-stamping owner in the chat layer | No sync-module change | The busy-re-publish re-stamp trap re-implemented per surface | Rejected — one fact, one owner |
| Capability port on RuntimeAPIs for surface gating | Explicit host capability | An interface with one implementation | Rejected — unnecessary port |
| Reading `__OPENCHAMBER_PANEL_TYPE__` window-globals in shared UI | No plumbing | Implicit coupling, untestable per component | Rejected — implicit coupling |
| Default ON with opt-outs for mobile/electron | Less plumbing | Changes surfaces the owner did not name by default | Rejected — containment |
| Per-locale translated copies (mirroring sidebar `activeFor`) | Follows translate-everything rule | Value is emoji+placeholder (locale-neutral); copies add drift risk only | Rejected; superseded by owner-order for one identical-value key |
| Literal raw-seconds copy (`🕐 {n}s`) | Matches requested string literally | Unbounded untranslated seconds; breaks no-concatenation i18n contract | Rejected — one-key reversal kept open |
| Reuse/relax the sidebar counter for the watched session | Free code | Contradicts its documented watching-session rule | Rejected |

## Consequences

- **Positive:** both named surfaces stay covered by one shared-tree changeset; the derivation stays
  pinned by one module's tests; un-named surfaces are byte-unchanged (default-OFF goldens); the
  no-fabricated-zero rule protects honesty for mid-turn joins.
- **Negative:** during gated boots an unlabeled counter reads as "the model is slow" (labeling was
  deliberately deferred); the 11 identical dictionaries invite drive-by "fixes" (mitigated by
  memory 0006); the same invariant exists independently in sibling surfaces in other repos.
- **Neutral:** `unknownStarts` never changes `startedAt` semantics; existing consumers observe nothing.

## Feature state (as of 2026-10-31, reviewed honestly)

- Developed and developer-accepted (plan tasks T1–T4 with full re-runs; suite +21 owned tests,
  final 300/300 files 2710 pass / 0 fail; see session validation record).
- Committed by the OWNER as `87eefa6e` on `patched/main2` (parent `708b2514`); agents committed nothing.
- **NOT released:** vsix/web packaging is the owner's release step and was not exercised.
- **NOT runtime-verified for the boot window here:** the scenario depends on the unlanded
  busy-hoist change in the separate better-opencode engine (cross-repo dependency, referenced once
  deliberately); the live boot-window canary is OPEN pending owner action. Ordinary-turn behavior
  is mechanically proven by tests. A reviewer pass is the next pipeline step.

## Verification (codebase)

Verified at commit `87eefa6e` (rg/git/read, 2026-10-31 vault-keeper pass):

- `packages/ui/src/sync/session-activity-timing.ts` — `unknownStarts` set + `unknownStarts`
  membership maintenance in the transition/reconcile paths; `useSessionActivityObservedStartAt`,
  `useHasSessionActivityRunningDuration` exported; prior exports and the settled lifecycle intact
  (diff removes were mechanical provenance threading only).
- `packages/ui/src/components/chat/chatTurnElapsedFormat.ts` — single-key formatter over
  `formatSessionActivityDuration`.
- `chat.statusRow.runningFor` — exactly 1× per dict × 11 dicts; values byte-identical `🕐 {duration}`;
  no new unit keys.
- `ChatTurnElapsedLine.tsx` / `ComposerFooter.tsx` / prop chain / `MainLayout.tsx` (2 mount sites) /
  `VSCodeLayout.tsx` (3 mount sites) — default-OFF at every hop; zero mentions outside named roots
  (source-scan test: `runningElapsedMountedSurfaces.test-utils.ts`).
- `WorkingPlaceholder`, `chat/StatusRow` — zero diff vs `708b2514`.
- Docs carriers: `sync/DOCUMENTATION.md` (provenance + two lifetimes),
  `chat/composer/DOCUMENTATION.md` (mounted-capture testing rule).
