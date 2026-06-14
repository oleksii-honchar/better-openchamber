import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/lib/device', () => ({
  useDeviceInfo: () => ({ isMobile: false, isTablet: false, hasTouchInput: false }),
}));

mock.module('@/lib/opencode/client', () => ({
  opencodeClient: {
    listLocalDirectory: async () => [],
    getApiClient: () => ({
      file: { list: async () => ({ data: [] }) },
    }),
  },
}));

mock.module('@/hooks/useRuntimeAPIs', () => ({
  useRuntimeAPIs: () => ({
    files: {
      listDirectory: async () => ({ entries: [] }),
      writeFile: null,
      createDirectory: null,
      rename: null,
      delete: null,
      revealPath: null,
      downloadFile: undefined,
    },
  }),
}));

mock.module('@/hooks/useEffectiveDirectory', () => ({
  useEffectiveDirectory: () => null,
}));

mock.module('@/stores/useFileSearchStore', () => ({
  useFileSearchStore: () => ({
    searchFiles: async () => [],
  }),
}));

mock.module('@/stores/useFilesViewTabsStore', () => ({
  useFilesViewTabsStore: () => [],
}));

mock.module('@/stores/useUIStore', () => ({
  useUIStore: () => ([]),
}));

mock.module('@/stores/useGitStore', () => ({
  useGitStatus: () => null,
}));

mock.module('@/lib/directoryShowHidden', () => ({
  useDirectoryShowHidden: () => false,
}));

mock.module('@/lib/filesViewShowGitignored', () => ({
  useFilesViewShowGitignored: () => false,
}));

mock.module('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}));

mock.module('@/lib/runtime-fetch', () => ({
  runtimeFetch: async () => ({
    ok: true,
    json: async () => ({}),
  }),
}));

mock.module('@/lib/clipboard', () => ({
  copyTextToClipboard: async () => ({ ok: true }),
}));

import { I18nProvider } from '@/lib/i18n';
import { SidebarFilesTree } from './SidebarFilesTree';

describe('SidebarFilesTree', () => {
  test('renders FILES_TREE test ID on the ScrollableOverlay', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SidebarFilesTree />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="sidebar-files-tree"');
  });
});
