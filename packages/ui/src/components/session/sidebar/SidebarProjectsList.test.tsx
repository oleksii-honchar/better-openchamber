import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/contexts/useThemeSystem', () => ({
  useThemeSystem: () => ({
    currentTheme: {
      metadata: { id: 'light', name: 'Light', description: '', version: '1', variant: 'light', tags: [] },
      colors: {
        primary: { base: '#000', foreground: '#fff' },
        surface: { background: '#fff', foreground: '#000', muted: '#f0f0f0', mutedForeground: '#666', elevated: '#fff', elevatedForeground: '#000', overlay: '#000', subtle: '#f5f5f5' },
        interactive: { border: '#ccc', borderHover: '#999', borderFocus: '#666', selection: '#007aff', selectionForeground: '#fff', focusRing: '#007aff', hover: '#e8e8e8' },
        status: {
          error: '#ff3b30', errorForeground: '#fff', errorBackground: '#ffeeed', errorBorder: '#ff3b30',
          warning: '#ff9500', warningForeground: '#fff', warningBackground: '#fff4e5', warningBorder: '#ff9500',
          success: '#34c759', successForeground: '#fff', successBackground: '#e8f8ee', successBorder: '#34c759',
          info: '#007aff', infoForeground: '#fff', infoBackground: '#e5f2ff', infoBorder: '#007aff',
        },
        syntax: {
          base: { background: '#fff', foreground: '#000', keyword: '#000', string: '#000', number: '#000', function: '#000', variable: '#000', type: '#000', comment: '#000', operator: '#000' },
          highlights: { diffAdded: '#00ff00', diffRemoved: '#ff0000', lineNumber: '#ccc' },
        },
      },
    } as any,
    availableThemes: [],
    setTheme: () => {},
    customThemesLoading: false,
    reloadCustomThemes: async () => {},
    isSystemPreference: false,
    setSystemPreference: () => {},
    themeMode: 'light',
    setThemeMode: () => {},
    lightThemeId: 'light',
    darkThemeId: 'dark',
    setLightThemePreference: () => {},
    setDarkThemePreference: () => {},
  }),
}));

import { I18nProvider } from '@/lib/i18n';
import { SidebarProjectsList } from './SidebarProjectsList';

function createMinimalProps(overrides: Partial<Parameters<typeof SidebarProjectsList>[0]> = {}) {
  const defaultRenderGroup = () => <div />;
  const defaultProps = {
    sharedSessionsOnly: false,
    hasSharedSessions: false,
    sectionsForRender: [],
    projectSections: [],
    activeProjectId: null,
    showOnlyMainWorkspace: false,
    hasSessionSearchQuery: false,
    emptyState: <div data-testid="empty-state" />,
    searchEmptyState: <div data-testid="search-empty-state" />,
    renderGroupSessions: defaultRenderGroup,
    homeDirectory: null,
    collapsedProjects: new Set<string>(),
    hideDirectoryControls: false,
    projectRepoStatus: new Map<string, boolean | null>(),
    isDesktopShellRuntime: false,
    stuckProjectHeaders: new Set<string>(),
    mobileVariant: false,
    alwaysShowActions: false,
    toggleProject: () => {},
    setActiveProjectIdOnly: () => {},
    setActiveMainTab: () => {},
    setSessionSwitcherOpen: () => {},
    openNewSessionDraft: () => {},
    openNewWorktreeDialog: () => {},
    openProjectEditDialog: () => {},
    removeProject: () => {},
    projectHeaderSentinelRefs: { current: new Map() } as React.MutableRefObject<Map<string, HTMLDivElement | null>>,
    reorderProjects: () => {},
    getOrderedGroups: () => [],
    setGroupOrderByProject: () => {},
    openSidebarMenuKey: null,
    setOpenSidebarMenuKey: () => {},
    isInlineEditing: false,
  };
  return { ...defaultProps, ...overrides };
}

describe('SidebarProjectsList', () => {
  test('renders PROJECTS_LIST test ID on shared sessions branch', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SidebarProjectsList {...createMinimalProps({ sharedSessionsOnly: true })} />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="sidebar-projects-list"');
  });

  test('renders PROJECTS_SHARED test ID when no projects exist', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SidebarProjectsList {...createMinimalProps({ projectSections: [] })} />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="sidebar-projects-shared"');
  });

  test('renders PROJECTS_SEARCH_EMPTY test ID when search yields no results', () => {
    const mockSection = {
      project: {
        id: 'proj-1',
        normalizedPath: '/tmp/test',
      },
      groups: [],
    };
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SidebarProjectsList
          {...createMinimalProps({
            projectSections: [mockSection as any],
            sectionsForRender: [],
            hasSessionSearchQuery: true,
          })}
        />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="sidebar-projects-search-empty"');
  });

  test('renders PROJECTS_EMPTY test ID on main branch with sections', () => {
    const mockSection = {
      project: {
        id: 'proj-1',
        normalizedPath: '/tmp/test',
      },
      groups: [],
    };
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SidebarProjectsList
          {...createMinimalProps({
            projectSections: [mockSection as any],
            sectionsForRender: [mockSection as any],
          })}
        />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="sidebar-projects-empty"');
  });
});
