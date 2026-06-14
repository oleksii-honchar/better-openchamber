import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/lib/device', () => ({
  useDeviceInfo: () => ({ isMobile: false, isTablet: false, hasTouchInput: false }),
}));

mock.module('@/lib/opencode/client', () => ({
  opencodeClient: {
    getFilesystemHome: async () => '/tmp',
    getSystemInfo: async () => ({ homeDirectory: '/tmp' }),
    listLocalDirectory: async () => [],
    getApiClient: () => ({
      file: {
        list: async () => ({ data: [] }),
      },
    }),
  },
}));

mock.module('@/lib/runtime-fetch', () => ({
  runtimeFetch: async () => ({
    ok: true,
    json: async () => ({}),
  }),
}));

mock.module('@/hooks/useFileSystemAccess', () => ({
  useFileSystemAccess: () => ({
    requestAccess: async () => ({ success: false, path: null, error: new Error('mock') }),
    startAccessing: async () => {},
    isDesktop: false,
  }),
}));

import { I18nProvider } from '@/lib/i18n';
import { DirectoryTree } from './DirectoryTree';

describe('DirectoryTree', () => {
  test('renders DIRECTORY_TREE test ID on inline variant', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <DirectoryTree currentPath="/tmp" onSelectPath={() => {}} variant="inline" />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="directory-tree-list"');
  });

  test('renders DIRECTORY_TREE_SHARING test ID on dropdown variant', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <DirectoryTree currentPath="/tmp" onSelectPath={() => {}} variant="dropdown" />
      </I18nProvider>
    );
    expect(markup).toContain('data-testid="directory-tree-sharing"');
  });
});
