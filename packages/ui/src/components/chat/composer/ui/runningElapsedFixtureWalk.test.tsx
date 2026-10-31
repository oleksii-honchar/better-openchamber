/**
 * v9 T4 — the design fixture walked end-to-end through the shipped paths.
 *
 * One scripted scenario replaying the 47 s gated-turn fixture row table from
 * materials/design-elapsed-counter-v9.md §6, re-rendered under the A-v9.2 copy
 * (§12) through the mounted `ComposerFooter` (the same surface the webui and
 * extension chats render), driven by the same store path production uses:
 *
 *   t0.3  observed busy (idle→busy edge)   → line appears
 *   t49.7 render                          → exactly `🕐 49s`
 *   t50 / t55 / t60 busy RE-PUBLISH        → start not re-stamped; values
 *                                            continue from the original origin
 *   t181.3 (hypothetical branch)           → `🕐 3m 1s` (translated units)
 *   snapshot-joined session (never observed) → no line even at the same moment
 *                                              (unknown start, ever)
 *   t62 session.idle                       → line gone in the same update
 *
 * This file deliberately runs the FULL lifecycle as one continuous scenario:
 * `ChatTurnElapsedLine.test.tsx` pins the leaf's individual states,
 * `composerFooterRunningElapsed.test.tsx` pins opt-in containment and the
 * single-moment footer behavior, and `session-activity-timing.test.ts` pins the
 * derivation in isolation — none of them walks this timeline joined.
 *
 * The shared fixture clock, module stubs, mounted renderer, and store seeding
 * live in runningElapsedFooterHarness.test-utils.tsx; `mock.module` is
 * process-global, so this file must run as its own unit (`bun test <file>`,
 * per composer/DOCUMENTATION.md and run-isolated-tests.mjs).
 */
import { describe, expect, test } from 'bun:test';
import { act } from 'react';

import {
  observeSessionActivityTiming,
  reconcileSessionActivityTiming,
} from '@/sync/session-activity-timing';
import {
  SESSION_ID,
  footerElement,
  mountFixture,
  nowOffset,
  renderFooter,
  seedObservedRunningTurn,
  startFixtureClock,
  stopFixtureClock,
} from './runningElapsedFooterHarness.test-utils';

/** A second session first seen through an authoritative snapshot (joined mid-turn). */
const JOINED_SESSION_ID = 'ses_elapsed_walk_joined_mid_turn';

/**
 * The line element with exactly this label text (the serializer sorts
 * attributes; match order-free, same idiom as the footer test). The emoji also
 * occurs in the element's own aria-label/title attributes, so counting the
 * line means counting matching SPANS, not emoji occurrences.
 */
const lineSpans = (markup: string, label: string): string[] =>
  markup.match(
    new RegExp(
      `<span[^>]*class="shrink-0 tabular-nums text-primary"[^>]*>${label}<\\/span>`,
      'g',
    ),
  ) ?? [];

const expectSingleRenderedLine = (markup: string, label: string): void => {
  expect(lineSpans(markup, label)).toHaveLength(1);
};

describe('v9 T4 fixture walk — one 47s gated turn through the shipped chat line', () => {
  test('start t0.3 → 🕐 49s → re-publish continues → hypothetical 3m 1s → snapshot-join silent → idle clears', async () => {
    const t0 = 1_780_000_000_000;
    startFixtureClock(t0);
    const at = (ms: number): void => {
      nowOffset(t0, ms);
    };

    try {
      // t0 + 300ms: the hoisted idle→busy observation. The turn's origin is
      // this instant; every later value below is measured from it.
      at(300);
      seedObservedRunningTurn();

      // t49.7 — 49.4s elapsed. The owner's requested string, floor-rendered.
      at(49_700);
      expectSingleRenderedLine(
        await renderFooter({ runningElapsedVisible: true }),
        '🕐 49s',
      );

      // t50 / t55 / t60 — the runLoop re-publishes busy (fixture M1 trap).
      // The origin must NOT move: rendered values keep counting from t0.3.
      for (const [republishedAt, expected] of [
        [50_000, '🕐 49s'],
        [55_000, '🕐 54s'],
        [60_000, '🕐 59s'],
      ] as const) {
        at(republishedAt);
        observeSessionActivityTiming(SESSION_ID, 'active');
        expectSingleRenderedLine(
          await renderFooter({ runningElapsedVisible: true }),
          expected,
        );
      }

      // Hypothetical t181.3 (the "3m 1s" row of the §12 re-render; the real
      // scenario ends at t62 — this branch only extends the clock): the line
      // switches to translated compound units, still counting from t0.3.
      at(181_300);
      expectSingleRenderedLine(
        await renderFooter({ runningElapsedVisible: true }),
        '🕐 3m 1s',
      );

      // A snapshot that reports this directory busy for BOTH sessions while
      // this client never saw the joiner begin: the watched turn keeps its
      // line; the joined-mid-turn session renders nothing — no `🕐 0s`,
      // no fabricated origin — byte-identical to the prop-off footer.
      const joinedOff = await renderFooter({
        runningElapsedVisible: false,
        sessionId: JOINED_SESSION_ID,
      });
      reconcileSessionActivityTiming(
        new Set([SESSION_ID, JOINED_SESSION_ID]),
        () => true,
      );
      const joinedOn = await renderFooter({
        runningElapsedVisible: true,
        sessionId: JOINED_SESSION_ID,
      });
      expect(joinedOn).toBe(joinedOff);
      expect(joinedOn).not.toContain('🕐');

      // The same snapshot pass touched the watched turn's provenance not at
      // all: it is still observed, still counting from t0.3.
      expectSingleRenderedLine(
        await renderFooter({ runningElapsedVisible: true }),
        '🕐 3m 1s',
      );

      // t62 — session.idle on the mounted surface: the line disappears in the
      // same update that ends the turn for every other reader. The fixture's
      // hypothetical branch ends here; the clock returns to the scenario.
      // (Mounted just under the minute so the pre-idle state pins the plain
      // sub-60s form; past 60s this same turn had its `3m 1s` branch above.)
      at(59_900);
      const fixture = await mountFixture(footerElement({ runningElapsedVisible: true }));
      try {
        expectSingleRenderedLine(fixture.html, '🕐 59s');

        at(62_000);
        await act(async () => {
          observeSessionActivityTiming(SESSION_ID, 'settled');
        });

        expect(fixture.html).not.toContain('🕐');
      } finally {
        await fixture.cleanup();
      }
    } finally {
      stopFixtureClock();
    }
  });
});
