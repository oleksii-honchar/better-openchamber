import { describe, expect, test } from 'bun:test';
import { SESSION_GROUPING_OPTIONS } from './SidebarHeader';

describe('SidebarHeader session grouping options', () => {
  test('exposes the global-flat option with its i18n label key', () => {
    const modes = SESSION_GROUPING_OPTIONS.map(([mode]) => mode);

    expect(modes).toEqual(['by-worktree', 'flat', 'global-flat']);
  });

  test('points the global-flat option at the globalFlat i18n key', () => {
    const option = SESSION_GROUPING_OPTIONS.find(([mode]) => mode === 'global-flat');

    expect(option?.[1]).toBe('sessions.sidebar.header.grouping.globalFlat');
  });
});
