/**
 * Composer-region integration coverage for the opt-in running-elapsed line
 * (v9 Lane C, A-v9.1 D-5).
 *
 * Two things are proven here, matching the plan's containment strategy:
 *
 * 1. OFF is byte-identical to the pre-change composer footer. `GOLDEN_FOOTER_OFF`
 *    is the mounted-tree serialization of this exact fixture captured from the
 *    PRISTINE implementation at 708b2514 (its `ComposerFooter.tsx` taken
 *    verbatim from the pin commit), through this harness's own renderer
 *    (session record: data-v9t3-golden-before-mounted.log). After the change,
 *    rendering the same fixture with the prop absent or explicitly false must
 *    reproduce those bytes exactly.
 * 2. ON inserts exactly the elapsed line at the working/stop affordance —
 *    asserted against the stubbed `ComposerActionButtons` anchor that marks
 *    where that affordance lives.
 *
 * The fixture, child stubs, fake DOM, and renderer live in
 * runningElapsedFooterHarness.test-utils.tsx so the golden and this test can
 * never drift apart. `mock.module` is process-global, so this file must run as
 * its own unit (`bun test <file>`, per composer/DOCUMENTATION.md).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { observeSessionActivityTiming } from '@/sync/session-activity-timing';
import {
  ACTION_BUTTONS_ANCHOR,
  SESSION_ID,
  footerElement,
  mountFixture,
  nowOffset,
  renderFooter,
  seedObservedRunningTurn,
  startFixtureClock,
  stopFixtureClock,
} from './runningElapsedFooterHarness.test-utils';
import { runningElapsedMountViolations } from './runningElapsedMountedSurfaces.test-utils';

const GOLDEN_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'runningElapsedFooterGolden.json',
);

// Byte-exact golden of the pre-change footer for this fixture ("off" key).
// Regenerating it legitimately requires re-capturing from the pristine
// implementation (git show 708b2514:…/ComposerFooter.tsx) — do not "fix" this
// file by re-capturing after a change.
const GOLDEN_FOOTER_OFF: string = (JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as { off: string }).off;

describe('ComposerFooter running-elapsed opt-in', () => {
  // Fixture clock + store seeding shared with the golden capture.
  let t0 = 0;
  const at = (ms: number): void => {
    nowOffset(t0, ms);
  };

  beforeEach(() => {
    t0 = Date.now();
    startFixtureClock(t0);
  });

  afterEach(() => {
    stopFixtureClock();
  });

  test('prop absent: rendered footer equals the pre-change golden byte-for-byte', async () => {
    // Even with a running observed turn available, the default must not render.
    seedObservedRunningTurn();
    at(37_000);

    expect(await renderFooter()).toBe(GOLDEN_FOOTER_OFF);
  });

  test('prop explicitly false: same golden, untouched', async () => {
    seedObservedRunningTurn();
    at(37_000);

    expect(await renderFooter({ runningElapsedVisible: false })).toBe(GOLDEN_FOOTER_OFF);
  });

  test('prop true + running turn with observed start: line renders at the stop affordance', async () => {
    seedObservedRunningTurn();
    at(37_000);

    const markup = await renderFooter({ runningElapsedVisible: true });
    expect(markup).toContain('>🕐 37s<');
    // Exactly one line element (its aria-label/title may repeat the copy).
    // (The serializer writes attributes in sorted order; match order-free.)
    const lineElements = markup.match(/<span(?=[^>]*class="shrink-0 tabular-nums text-primary")[^>]*>🕐 37s<\/span>/g) ?? [];
    expect(lineElements).toHaveLength(1);
    const [lineElement] = lineElements;
    if (lineElement === undefined) {
      throw new Error('unreachable: lineElements asserted to have length 1');
    }
    // It reads as part of the working/stop cluster: the line sits before the
    // action-button anchor within the footer's right side.
    const lineIndex = markup.indexOf(lineElement);
    const anchorIndex = markup.indexOf(ACTION_BUTTONS_ANCHOR);
    expect(anchorIndex).toBeGreaterThan(lineIndex);
    // Apart from the line, the tree equals the golden tree.
    expect(markup.replace(lineElement, '')).toBe(GOLDEN_FOOTER_OFF);
  });

  test('prop true but no turn running: footer output equals the prop-false footer', async () => {
    at(37_000);
    const off = await renderFooter({ runningElapsedVisible: false });
    expect(await renderFooter({ runningElapsedVisible: true })).toBe(off);
    expect(off).not.toContain('🕐');
  });

  test('prop true + turn settles while mounted: line removed in the same update', async () => {
    seedObservedRunningTurn();
    at(37_000);

    const fixture = await mountFixture(footerElement({ runningElapsedVisible: true }));
    try {
      expect(fixture.html).toContain('>🕐 37s<');

      // The same store update that ends the turn for every other reader
      // (session.idle / session.error edge) removes the line.
      await act(async () => {
        observeSessionActivityTiming(SESSION_ID, 'settled');
      });

      expect(fixture.html).not.toContain('🕐');
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('runningElapsedVisible enablement containment (D-5)', () => {
  test('enabled at exactly the MainLayout and VSCodeLayout ChatView mounts', () => {
    expect(runningElapsedMountViolations()).toEqual([]);
  });
});
