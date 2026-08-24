import { describe, expect, test } from 'bun:test';
import type { Session } from '@opencode-ai/sdk/v2';
import { getPinnedSessionKey } from '@/stores/useSessionPinnedStore';
import { switchRuntimeEndpoint, getRuntimeKey } from '@/lib/runtime-switch';
import type { SessionGroup, SessionNode } from '../types';
import { buildGlobalFlatSection } from './useSessionSidebarSections';

// ── Factory helpers ──────────────────────────────────────────────────────────

const session = (id: string, updated: number, created = updated): Session => ({
  id,
  slug: id,
  projectID: 'project-a',
  directory: '/projects/a',
  title: id,
  version: '1',
  time: { created, updated },
});

const node = (session: Session): SessionNode => ({ session, children: [], worktree: null });

const group = (overrides: Partial<SessionGroup> = {}): SessionGroup => ({
  id: 'flat',
  label: '',
  branch: null,
  description: null,
  isMain: true,
  worktree: null,
  directory: '/projects/a',
  folderScopeKey: '/projects/a',
  sessions: [],
  ...overrides,
});

const section = (projectId: string, groups: SessionGroup[]) => ({
  project: {
    id: projectId,
    path: `/projects/${projectId}`,
    normalizedPath: `/projects/${projectId}`,
  },
  groups,
});

const projectGroup = (projectId: string, overrides: Partial<SessionGroup> = {}): SessionGroup =>
  group({
    directory: `/projects/${projectId}`,
    folderScopeKey: `/projects/${projectId}`,
    ...overrides,
  });

const pinnedKeyFor = (directory: string, sessionId: string): string => {
  const key = getPinnedSessionKey(getRuntimeKey(), directory, sessionId);
  if (!key) throw new Error('failed to build pinned key');
  return key;
};

describe('buildGlobalFlatSection', () => {
  test('merges sessions from multiple projects into a single non-archived group', () => {
    const sections = [
      section('alpha', [
        projectGroup('alpha', {
          sessions: [node(session('alpha-1', 1000)), node(session('alpha-2', 1200))],
        }),
      ]),
      section('beta', [
        projectGroup('beta', {
          sessions: [node(session('beta-1', 900))],
        }),
      ]),
    ];

    const merged = buildGlobalFlatSection(sections, new Set(), new Map(), 'All sessions');

    expect(merged).not.toBeNull();
    expect(merged?.groups).toHaveLength(1);
    expect(merged?.groups[0]?.isArchivedBucket).toBe(false);
    expect(merged?.groups[0]?.sessions.map((entry) => entry.session.id).sort()).toEqual([
      'alpha-1',
      'alpha-2',
      'beta-1',
    ]);
  });

  test('orders the merged list by last-active descending with pinned sessions first', () => {
    const pinnedA = session('pinned-a', 1500);
    const newer = session('newer', 2000);
    const older = session('older', 1000);
    const sections = [
      section('alpha', [projectGroup('alpha', { sessions: [node(newer), node(pinnedA)] })]),
      section('beta', [projectGroup('beta', { sessions: [node(older)] })]),
    ];
    const pinnedSessionIds = new Set([pinnedKeyFor('/projects/a', pinnedA.id)]);

    const merged = buildGlobalFlatSection(sections, pinnedSessionIds, new Map(), 'All sessions');

    expect(merged?.groups[0]?.sessions.map((entry) => entry.session.id)).toEqual([
      pinnedA.id,
      newer.id,
      older.id,
    ]);
  });

  test('excludes archived buckets from the merged group', () => {
    const archivedSession = session('archived-1', 500);
    const activeSession = session('active-1', 1500);
    const sections = [
      section('alpha', [
        projectGroup('alpha', { sessions: [node(activeSession)] }),
        group({
          id: 'archived',
          label: 'archived',
          isArchivedBucket: true,
          sessions: [node(archivedSession)],
        }),
      ]),
    ];

    const merged = buildGlobalFlatSection(sections, new Set(), new Map(), 'All sessions');

    expect(merged?.groups[0]?.sessions.map((entry) => entry.session.id)).toEqual(['active-1']);
  });

  test('aggregates folder scopes across projects and dedupes by scope key', () => {
    const sections = [
      section('alpha', [
        projectGroup('alpha', {
          folderScopes: [
            { scopeKey: '/projects/alpha', directory: '/projects/alpha' },
            { scopeKey: '/projects/alpha/wt-1', directory: '/projects/alpha/wt-1' },
          ],
          sessions: [node(session('alpha-1', 1000))],
        }),
      ]),
      section('beta', [
        projectGroup('beta', {
          sessions: [node(session('beta-1', 900))],
        }),
      ]),
    ];

    const merged = buildGlobalFlatSection(sections, new Set(), new Map(), 'All sessions');

    expect(merged?.groups[0]?.folderScopes).toEqual([
      { scopeKey: '/projects/alpha', directory: '/projects/alpha' },
      { scopeKey: '/projects/alpha/wt-1', directory: '/projects/alpha/wt-1' },
      { scopeKey: '/projects/beta', directory: '/projects/beta' },
    ]);
  });

  test('returns null when no non-archived groups exist', () => {
    const sections = [
      section('alpha', [
        group({
          id: 'archived',
          label: 'archived',
          isArchivedBucket: true,
          sessions: [node(session('archived-1', 1000))],
        }),
      ]),
    ];

    expect(buildGlobalFlatSection(sections, new Set(), new Map(), 'All sessions')).toBeNull();
  });
});
