import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/stores/useConfigStore', () => ({
    useConfigStore: (selector: (state: any) => any) => {
        const state = {
            getVisibleAgents: () => [],
            agents: [],
        };
        return selector(state);
    },
}));

mock.module('@/stores/useAgentsStore', () => ({
    useAgentsStore: (selector: (state: any) => any) => {
        const state = {
            agents: [],
            loadAgents: async () => {},
        };
        return selector(state);
    },
    isAgentBuiltIn: () => false,
}));

import { I18nProvider } from '@/lib/i18n';
import { AgentMentionAutocomplete } from '@/components/chat/AgentMentionAutocomplete';

describe('AgentMentionAutocomplete', () => {
    test('renders ScrollableOverlay with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <AgentMentionAutocomplete
                    searchQuery=""
                    onAgentSelect={() => {}}
                    onClose={() => {}}
                />
            </I18nProvider>
        );

        expect(markup).toContain('data-testid="autocomplete-agent"');
    });
});
