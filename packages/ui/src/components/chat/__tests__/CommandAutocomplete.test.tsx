import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/sync/session-ui-store', () => ({
    useSessionUIStore: (selector: (state: any) => any) => {
        const state = {
            currentSessionId: 'test-session',
            newSessionDraft: null,
        };
        return selector(state);
    },
}));

mock.module('@/sync/sync-context', () => ({
    useSessionMessages: () => [],
}));

mock.module('@/stores/useCommandsStore', () => ({
    useCommandsStore: (selector: (state: any) => any) => {
        const state = {
            commands: [],
            loadCommands: async () => {},
        };
        return selector(state);
    },
}));

mock.module('@/stores/useSkillsStore', () => ({
    useSkillsStore: (selector: (state: any) => any) => {
        const state = {
            skills: [],
            loadSkills: async () => {},
        };
        return selector(state);
    },
}));

mock.module('@/stores/useUIStore', () => ({
    useUIStore: (selector: (state: any) => any) => {
        const state = { isMobile: false };
        return selector(state);
    },
}));

mock.module('@/lib/desktop', () => ({
    isVSCodeRuntime: () => false,
}));

import { I18nProvider } from '@/lib/i18n';
import { CommandAutocomplete } from '@/components/chat/CommandAutocomplete';

describe('CommandAutocomplete', () => {
    test('renders ScrollableOverlay with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <CommandAutocomplete
                    searchQuery=""
                    onCommandSelect={() => {}}
                    onClose={() => {}}
                />
            </I18nProvider>
        );

        expect(markup).toContain('data-testid="autocomplete-command"');
    });
});
