/**
 * Behavior tests for the composer-region running-turn elapsed line (v9 Lane C).
 *
 * Rendering happens through the mounted-DOM path of the shared harness: the
 * live turn-timing store is only observable to CLIENT renders (server
 * rendering reads a store's initial snapshot). Time is fixed with the fixture
 * clock from session-activity-timing.test.ts; the "advances on the next tick"
 * case lets the leaf's own 1 fps ticker channel do the advancing — the
 * mechanism under test is literally "one interval recomputes the text per
 * second", so the test waits one real interval while the fixture clock moves.
 */
import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  I18nProvider,
  mountFixture,
  nowOffset,
  renderMounted,
  resolveSessionActivity,
  startFixtureClock,
  stopFixtureClock,
} from './runningElapsedFooterHarness.test-utils';
import {
  observeSessionActivityTiming,
  reconcileSessionActivityTiming,
} from '@/sync/session-activity-timing';
import { ChatTurnElapsedLine } from './ChatTurnElapsedLine';

const SESSION_ID = 'ses_elapsed_leaf_fixture';
const EMPTY_TREE = '<div></div>';

const lineElement = (sessionId: string | null): React.ReactElement => (
  <I18nProvider>
    <ChatTurnElapsedLine sessionId={sessionId} />
  </I18nProvider>
);

describe('ChatTurnElapsedLine', () => {
  let t0 = 0;

  beforeEach(() => {
    t0 = Date.now();
    startFixtureClock(t0);
  });

  afterEach(() => {
    stopFixtureClock();
  });

  // Seed through the live module API (event path = observed start) with the
  // fixture clock placed at `ms` for the observe call itself.
  const observeTurnStartedAt = async (ms: number): Promise<void> => {
    nowOffset(t0, ms);
    observeSessionActivityTiming(SESSION_ID, 'active');
  };

  test('renders 🕐 37s exactly for an observed turn start 37 s ago', async () => {
    await observeTurnStartedAt(0);
    nowOffset(t0, 37_000);

    const markup = await renderMounted(lineElement(SESSION_ID));
    expect(markup).toContain('>🕐 37s<');
    // Theme-token styling only; the readout itself is the animation.
    expect(markup).toContain('class="shrink-0 tabular-nums text-primary"');
    expect(markup).not.toContain('animate');
    expect(markup).not.toContain('transition');
  });

  test('.tick: the mounted line advances through its real 1 fps interval (37s → 47s)', async () => {
    await observeTurnStartedAt(0);
    nowOffset(t0, 37_000);

    const fixture = await mountFixture(lineElement(SESSION_ID));
    try {
      expect(fixture.html).toContain('>🕐 37s<');

      // Move the fixture clock a full 10 s forward and let the leaf's shared
      // ticker channel fire (1000 ms interval). Poll with a bounded wait so a
      // loaded machine cannot flake the fixed-period assumption.
      nowOffset(t0, 47_000);
      let advanced = fixture.html;
      for (let i = 0; i < 40 && !advanced.includes('>🕐 47s<'); i += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        advanced = fixture.html;
      }
      expect(advanced).toContain('>🕐 47s<');
      expect(advanced).not.toContain('🕐 37s');
    } finally {
      await fixture.cleanup();
    }
  });

  test('a turn first seen through a status snapshot (unknown start) renders nothing at all', async () => {
    // Snapshot path only: this client saw the busy state, never its beginning.
    nowOffset(t0, 37_000);
    reconcileSessionActivityTiming(new Set([SESSION_ID]), () => true);

    const markup = await renderMounted(lineElement(SESSION_ID));
    expect(markup).toBe(EMPTY_TREE);
    // Never a fabricated zero.
    expect(markup).not.toContain('🕐 0s');
  });

  test('the line is gone right after the turn settles (same ticker store update)', async () => {
    await observeTurnStartedAt(0);
    nowOffset(t0, 37_000);

    const fixture = await mountFixture(lineElement(SESSION_ID));
    try {
      expect(fixture.html).toContain('>🕐 37s<');

      // `session.idle` / `session.error` edge → the module's settled write,
      // which clears the store entry the line renders from.
      await act(async () => {
        resolveSessionActivity('settled', SESSION_ID);
      });

      const after = fixture.html;
      expect(after).toBe(EMPTY_TREE);
      // Nothing persists after turn end: no settled tail.
      expect(after).not.toContain('🕐');
    } finally {
      await fixture.cleanup();
    }
  });

  test('renders nothing while no turn is running', async () => {
    expect(await renderMounted(lineElement(SESSION_ID))).toBe(EMPTY_TREE);
  });

  test('renders nothing without a session', async () => {
    await observeTurnStartedAt(0);
    nowOffset(t0, 37_000);
    expect(await renderMounted(lineElement(null))).toBe(EMPTY_TREE);
  });
});
