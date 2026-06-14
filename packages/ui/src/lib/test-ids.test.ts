import { describe, expect, test } from 'bun:test';
import { TEST_IDS } from './test-ids';

describe('TEST_IDS', () => {
  // ── Structure: all sections exist ──

  test('has CHAT section', () => {
    expect(TEST_IDS.CHAT).toBeDefined();
    expect(typeof TEST_IDS.CHAT).toBe('object');
  });

  test('has AUTOCOMPLETE section', () => {
    expect(TEST_IDS.AUTOCOMPLETE).toBeDefined();
    expect(typeof TEST_IDS.AUTOCOMPLETE).toBe('object');
  });

  test('has SIDEBAR section', () => {
    expect(TEST_IDS.SIDEBAR).toBeDefined();
    expect(typeof TEST_IDS.SIDEBAR).toBe('object');
  });

  test('has VIEWS section', () => {
    expect(TEST_IDS.VIEWS).toBeDefined();
    expect(typeof TEST_IDS.VIEWS).toBe('object');
  });

  test('has SETTINGS section', () => {
    expect(TEST_IDS.SETTINGS).toBeDefined();
    expect(typeof TEST_IDS.SETTINGS).toBe('object');
  });

  test('has SETTINGS_SIDEBAR section', () => {
    expect(TEST_IDS.SETTINGS_SIDEBAR).toBeDefined();
    expect(typeof TEST_IDS.SETTINGS_SIDEBAR).toBe('object');
  });

  test('has UI section', () => {
    expect(TEST_IDS.UI).toBeDefined();
    expect(typeof TEST_IDS.UI).toBe('object');
  });

  test('has DIALOGS section', () => {
    expect(TEST_IDS.DIALOGS).toBeDefined();
    expect(typeof TEST_IDS.DIALOGS).toBe('object');
  });

  test('has DEBUG section', () => {
    expect(TEST_IDS.DEBUG).toBeDefined();
    expect(typeof TEST_IDS.DEBUG).toBe('object');
  });

  // ── CHAT section keys ──

  describe('CHAT section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.CHAT.CONTAINER).toBe('chat-container');
      expect(TEST_IDS.CHAT.MESSAGE).toBe('chat-message');
      expect(TEST_IDS.CHAT.MESSAGE_HEADER).toBe('message-header');
      expect(TEST_IDS.CHAT.ASSISTANT_TEXT).toBe('assistant-text');
      expect(TEST_IDS.CHAT.USER_TEXT).toBe('user-text');
      expect(TEST_IDS.CHAT.TOOL_PART).toBe('tool-part');
      expect(TEST_IDS.CHAT.REASONING).toBe('reasoning-block');
      expect(TEST_IDS.CHAT.TURN).toBe('turn');
    });
  });

  // ── AUTOCOMPLETE section keys ──

  describe('AUTOCOMPLETE section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.AUTOCOMPLETE.AGENT).toBe('autocomplete-agent');
      expect(TEST_IDS.AUTOCOMPLETE.COMMAND).toBe('autocomplete-command');
      expect(TEST_IDS.AUTOCOMPLETE.FILE).toBe('autocomplete-file');
      expect(TEST_IDS.AUTOCOMPLETE.SKILL).toBe('autocomplete-skill');
      expect(TEST_IDS.AUTOCOMPLETE.SNIPPET).toBe('autocomplete-snippet');
    });
  });

  // ── SIDEBAR section keys ──

  describe('SIDEBAR section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.SIDEBAR.PROJECTS_LIST).toBe('sidebar-projects-list');
      expect(TEST_IDS.SIDEBAR.PROJECTS_SHARED).toBe('sidebar-projects-shared');
      expect(TEST_IDS.SIDEBAR.PROJECTS_EMPTY).toBe('sidebar-projects-empty');
      expect(TEST_IDS.SIDEBAR.PROJECTS_SEARCH_EMPTY).toBe('sidebar-projects-search-empty');
      expect(TEST_IDS.SIDEBAR.FILES_TREE).toBe('sidebar-files-tree');
      expect(TEST_IDS.SIDEBAR.DIRECTORY_TREE).toBe('directory-tree-list');
      expect(TEST_IDS.SIDEBAR.DIRECTORY_TREE_SHARING).toBe('directory-tree-sharing');
    });
  });

  // ── VIEWS section keys ──

  describe('VIEWS section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.VIEWS.DIFF_MAIN).toBe('diff-view-main');
      expect(TEST_IDS.VIEWS.DIFF_FILES).toBe('diff-view-files');
      expect(TEST_IDS.VIEWS.DIFF_DETAIL).toBe('diff-view-detail');
      expect(TEST_IDS.VIEWS.FILES_MAIN).toBe('files-view-main');
      expect(TEST_IDS.VIEWS.FILES_CHANGES).toBe('files-view-changes');
      expect(TEST_IDS.VIEWS.FILES_OTHER).toBe('files-view-other');
      expect(TEST_IDS.VIEWS.GIT_CONTENT).toBe('git-view-content');
      expect(TEST_IDS.VIEWS.GIT_HISTORY).toBe('git-history');
      expect(TEST_IDS.VIEWS.PIERRE_DIFF).toBe('pierre-diff-viewer');
      expect(TEST_IDS.VIEWS.PLAN).toBe('plan-view');
    });
  });

  // ── SETTINGS section keys ──

  describe('SETTINGS section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.SETTINGS.AGENTS).toBe('settings-agents');
      expect(TEST_IDS.SETTINGS.BEHAVIOR).toBe('settings-behavior');
      expect(TEST_IDS.SETTINGS.COMMANDS).toBe('settings-commands');
      expect(TEST_IDS.SETTINGS.GIT).toBe('settings-git');
      expect(TEST_IDS.SETTINGS.MCP).toBe('settings-mcp');
      expect(TEST_IDS.SETTINGS.OPENCHAMBER_GENERAL).toBe('settings-openchamber-general');
      expect(TEST_IDS.SETTINGS.OPENCHAMBER_METRICS).toBe('settings-openchamber-metrics');
      expect(TEST_IDS.SETTINGS.PROJECTS_LIST).toBe('settings-projects-list');
      expect(TEST_IDS.SETTINGS.PROJECTS_MAIN).toBe('settings-projects-main');
      expect(TEST_IDS.SETTINGS.PROVIDERS_LIST).toBe('settings-providers-list');
      expect(TEST_IDS.SETTINGS.PROVIDERS_CONFIG).toBe('settings-providers-config');
      expect(TEST_IDS.SETTINGS.PROVIDERS_DETAIL).toBe('settings-providers-detail');
      expect(TEST_IDS.SETTINGS.SKILLS_LIST).toBe('settings-skills-list');
      expect(TEST_IDS.SETTINGS.SKILLS_CONFIG).toBe('settings-skills-config');
      expect(TEST_IDS.SETTINGS.SKILLS_CATALOG).toBe('settings-skills-catalog');
      expect(TEST_IDS.SETTINGS.SNIPPETS).toBe('settings-snippets');
      expect(TEST_IDS.SETTINGS.USAGE).toBe('settings-usage');
      expect(TEST_IDS.SETTINGS.PAGE_LAYOUT).toBe('settings-page-layout');
      expect(TEST_IDS.SETTINGS.SIDEBAR_LAYOUT).toBe('settings-sidebar-layout');
    });
  });

  // ── SETTINGS_SIDEBAR section keys ──

  describe('SETTINGS_SIDEBAR section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.SETTINGS_SIDEBAR.AGENTS).toBe('sidebar-agents');
      expect(TEST_IDS.SETTINGS_SIDEBAR.COMMANDS).toBe('sidebar-commands');
      expect(TEST_IDS.SETTINGS_SIDEBAR.MCP).toBe('sidebar-mcp');
      expect(TEST_IDS.SETTINGS_SIDEBAR.PROVIDERS).toBe('sidebar-providers');
      expect(TEST_IDS.SETTINGS_SIDEBAR.SKILLS).toBe('sidebar-skills');
      expect(TEST_IDS.SETTINGS_SIDEBAR.SNIPPETS).toBe('sidebar-snippets');
      expect(TEST_IDS.SETTINGS_SIDEBAR.USAGE).toBe('sidebar-usage');
      expect(TEST_IDS.SETTINGS_SIDEBAR.MAGIC_PROMPTS).toBe('sidebar-magic-prompts');
    });
  });

  // ── UI section keys ──

  describe('UI section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.UI.COMMAND).toBe('ui-command');
      expect(TEST_IDS.UI.SELECT).toBe('ui-select');
      expect(TEST_IDS.UI.TEXTAREA).toBe('ui-textarea');
      expect(TEST_IDS.UI.MOBILE_OVERLAY).toBe('ui-mobile-overlay');
    });
  });

  // ── DIALOGS section keys ──

  describe('DIALOGS section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.DIALOGS.INSTALL_SKILL).toBe('dialog-install-skill');
      expect(TEST_IDS.DIALOGS.UPDATE_CHANGELOG).toBe('dialog-update-changelog');
    });
  });

  // ── DEBUG section keys ──

  describe('DEBUG section', () => {
    test('has all expected keys', () => {
      expect(TEST_IDS.DEBUG.MEMORY_KEYS).toBe('debug-memory-keys');
      expect(TEST_IDS.DEBUG.MEMORY_VALUE).toBe('debug-memory-value');
    });
  });

  // ── Value integrity checks ──

  describe('value integrity', () => {
    const allValues: string[] = [];
    const seenValues = new Set<string>();
    const duplicates: string[] = [];

    // Walk all nested values and collect them
    const collectValues = (obj: Record<string, unknown>, path: string) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          collectValues(value as Record<string, unknown>, `${path}.${key}`);
        } else if (typeof value === 'string') {
          allValues.push(value);
          if (seenValues.has(value)) {
            duplicates.push(value);
          }
          seenValues.add(value);
        }
      }
    };

    collectValues(TEST_IDS as unknown as Record<string, unknown>, 'TEST_IDS');

    test('all values are kebab-case strings', () => {
      const kebabRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      for (const value of allValues) {
        expect(value).toMatch(kebabRegex);
      }
    });

    test('contains no duplicate values across the entire registry', () => {
      expect(duplicates).toEqual([]);
    });

    test('values are non-empty strings', () => {
      for (const value of allValues) {
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });
});
