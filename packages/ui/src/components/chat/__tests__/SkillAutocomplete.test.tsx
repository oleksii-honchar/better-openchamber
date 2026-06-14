import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/stores/useSkillsStore', () => ({
    useSkillsStore: (selector: (state: any) => any) => {
        const state = {
            skills: [],
            loadSkills: async () => {},
        };
        return selector(state);
    },
}));

import { SkillAutocomplete } from '@/components/chat/SkillAutocomplete';

describe('SkillAutocomplete', () => {
    test('renders ScrollableOverlay with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <SkillAutocomplete
                searchQuery=""
                onSkillSelect={() => {}}
                onClose={() => {}}
            />
        );

        expect(markup).toContain('data-testid="autocomplete-skill"');
    });
});
