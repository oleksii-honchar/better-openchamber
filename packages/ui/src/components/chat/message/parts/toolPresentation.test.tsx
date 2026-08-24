import { describe, expect, test } from 'bun:test';
import { getToolIcon } from './toolPresentation';

describe('getToolIcon', () => {
    test('skill_search returns search icon', () => {
        const result = getToolIcon('skill_search');
        expect(result).toBeDefined();
        // The returned JSX element should be an Icon with name="search"
        expect(result.props.name).toBe('search');
    });

    test('meta_search returns search icon', () => {
        const result = getToolIcon('meta_search');
        expect(result).toBeDefined();
        expect(result.props.name).toBe('search');
    });

    test('meta_use returns arrow-right icon', () => {
        const result = getToolIcon('meta_use');
        expect(result).toBeDefined();
        expect(result.props.name).toBe('arrow-right');
    });

    test('skill_search uses the same iconClass as other icons', () => {
        const result = getToolIcon('skill_search');
        expect(result.props.className).toBe('h-3.5 w-3.5 flex-shrink-0');
    });

    test('existing icon mappings are unchanged (edit)', () => {
        expect(getToolIcon('edit').props.name).toBe('pencil');
    });

    test('existing icon mappings are unchanged (bash)', () => {
        expect(getToolIcon('bash').props.name).toBe('terminal-box');
    });

    test('existing icon mappings are unchanged (fallback)', () => {
        expect(getToolIcon('unknown_tool').props.name).toBe('tools');
    });

    test('case insensitive matching works', () => {
        expect(getToolIcon('SKILL_SEARCH').props.name).toBe('search');
        expect(getToolIcon('Meta_Search').props.name).toBe('search');
        expect(getToolIcon('META_USE').props.name).toBe('arrow-right');
    });
});
