import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/stores/useSnippetsStore', () => ({
    useSnippetsStore: (selector: (state: any) => any) => {
        const state = {
            snippets: [],
            loadSnippets: async () => {},
            setSnippetDraft: () => {},
            setSelectedSnippet: () => {},
        };
        return selector(state);
    },
}));

mock.module('@/stores/useUIStore', () => ({
    useUIStore: (selector: (state: any) => any) => {
        const state = {
            isMobile: false,
            setSettingsDialogOpen: () => {},
            setSettingsPage: () => {},
        };
        return selector(state);
    },
}));

import { I18nProvider } from '@/lib/i18n';
import { SnippetAutocomplete } from '@/components/chat/SnippetAutocomplete';

describe('SnippetAutocomplete', () => {
    test('renders ScrollableOverlay with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <SnippetAutocomplete
                    searchQuery=""
                    onSnippetSelect={() => {}}
                    onClose={() => {}}
                />
            </I18nProvider>
        );

        expect(markup).toContain('data-testid="autocomplete-snippet"');
    });
});
