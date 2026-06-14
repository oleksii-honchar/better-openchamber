import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/stores/useFileSearchStore', () => ({
    useFileSearchStore: (selector: (state: any) => any) => {
        const state = { searchFiles: async () => [] };
        return selector(state);
    },
}));

mock.module('@/stores/useConfigStore', () => ({
    useConfigStore: (selector: (state: any) => any) => {
        const state = { getVisibleAgents: () => [] };
        return selector(state);
    },
}));

mock.module('@/stores/useProjectsStore', () => ({
    useProjectsStore: (selector: (state: any) => any) => {
        const state = {
            activeProjectId: null,
            projects: [],
        };
        return selector(state);
    },
}));

mock.module('@/stores/useFilesViewTabsStore', () => ({
    useFilesViewTabsStore: () => undefined,
}));

mock.module('@/hooks/useDebouncedValue', () => ({
    useDebouncedValue: (_v: string) => '',
}));

mock.module('@/hooks/useChatSearchDirectory', () => ({
    useChatSearchDirectory: () => null,
}));

mock.module('@/lib/directoryShowHidden', () => ({
    useDirectoryShowHidden: () => false,
}));

mock.module('@/lib/filesViewShowGitignored', () => ({
    useFilesViewShowGitignored: () => false,
}));

import { I18nProvider } from '@/lib/i18n';
import { FileMentionAutocomplete } from '@/components/chat/FileMentionAutocomplete';

describe('FileMentionAutocomplete', () => {
    test('renders ScrollableOverlay with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <FileMentionAutocomplete
                    searchQuery=""
                    onFileSelect={() => {}}
                    onClose={() => {}}
                />
            </I18nProvider>
        );

        expect(markup).toContain('data-testid="autocomplete-file"');
    });
});
