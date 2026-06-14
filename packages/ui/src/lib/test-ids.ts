export const TEST_IDS = {
  // Chat components
  CHAT: {
    CONTAINER: 'chat-container',
    MESSAGE: 'chat-message',
    MESSAGE_HEADER: 'message-header',
    ASSISTANT_TEXT: 'assistant-text',
    USER_TEXT: 'user-text',
    TOOL_PART: 'tool-part',
    REASONING: 'reasoning-block',
    TURN: 'turn',
  },

  // Scrollable overlays — autocomplete
  AUTOCOMPLETE: {
    AGENT: 'autocomplete-agent',
    COMMAND: 'autocomplete-command',
    FILE: 'autocomplete-file',
    SKILL: 'autocomplete-skill',
    SNIPPET: 'autocomplete-snippet',
  },

  // Scrollable overlays — sidebar
  SIDEBAR: {
    PROJECTS_LIST: 'sidebar-projects-list',
    PROJECTS_SHARED: 'sidebar-projects-shared',
    PROJECTS_EMPTY: 'sidebar-projects-empty',
    PROJECTS_SEARCH_EMPTY: 'sidebar-projects-search-empty',
    FILES_TREE: 'sidebar-files-tree',
    DIRECTORY_TREE: 'directory-tree-list',
    DIRECTORY_TREE_SHARING: 'directory-tree-sharing',
  },

  // Scrollable overlays — views
  VIEWS: {
    DIFF_MAIN: 'diff-view-main',
    DIFF_FILES: 'diff-view-files',
    DIFF_DETAIL: 'diff-view-detail',
    FILES_MAIN: 'files-view-main',
    FILES_CHANGES: 'files-view-changes',
    FILES_OTHER: 'files-view-other',
    GIT_CONTENT: 'git-view-content',
    GIT_HISTORY: 'git-history',
    PIERRE_DIFF: 'pierre-diff-viewer',
    PLAN: 'plan-view',
  },

  // Scrollable overlays — settings
  SETTINGS: {
    AGENTS: 'settings-agents',
    BEHAVIOR: 'settings-behavior',
    COMMANDS: 'settings-commands',
    GIT: 'settings-git',
    MCP: 'settings-mcp',
    OPENCHAMBER_GENERAL: 'settings-openchamber-general',
    OPENCHAMBER_METRICS: 'settings-openchamber-metrics',
    PROJECTS_LIST: 'settings-projects-list',
    PROJECTS_MAIN: 'settings-projects-main',
    PROVIDERS_LIST: 'settings-providers-list',
    PROVIDERS_CONFIG: 'settings-providers-config',
    PROVIDERS_DETAIL: 'settings-providers-detail',
    SKILLS_LIST: 'settings-skills-list',
    SKILLS_CONFIG: 'settings-skills-config',
    SKILLS_CATALOG: 'settings-skills-catalog',
    SNIPPETS: 'settings-snippets',
    USAGE: 'settings-usage',
    PAGE_LAYOUT: 'settings-page-layout',
    SIDEBAR_LAYOUT: 'settings-sidebar-layout',
  },

  // Scrollable overlays — settings sidebars
  SETTINGS_SIDEBAR: {
    AGENTS: 'sidebar-agents',
    COMMANDS: 'sidebar-commands',
    MCP: 'sidebar-mcp',
    PROVIDERS: 'sidebar-providers',
    SKILLS: 'sidebar-skills',
    SNIPPETS: 'sidebar-snippets',
    USAGE: 'sidebar-usage',
    MAGIC_PROMPTS: 'sidebar-magic-prompts',
  },

  // Scrollable overlays — UI library
  UI: {
    COMMAND: 'ui-command',
    SELECT: 'ui-select',
    TEXTAREA: 'ui-textarea',
    MOBILE_OVERLAY: 'ui-mobile-overlay',
  },

  // Scrollable overlays — dialogs/debug
  DIALOGS: {
    INSTALL_SKILL: 'dialog-install-skill',
    UPDATE_CHANGELOG: 'dialog-update-changelog',
  },

  // Scrollable overlays — debug panels
  DEBUG: {
    MEMORY_KEYS: 'debug-memory-keys',
    MEMORY_VALUE: 'debug-memory-value',
  },
} as const;
