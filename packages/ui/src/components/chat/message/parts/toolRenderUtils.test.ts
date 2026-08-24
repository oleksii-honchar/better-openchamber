import { describe, expect, test } from 'bun:test';

import { isExpandableTool, isMetaTool, isStaticTool } from './toolRenderUtils';

describe('tool rendering classification', () => {
    test('keeps navigation tools compact', () => {
        expect(isStaticTool('read')).toBe(true);
        expect(isStaticTool('skill')).toBe(true);
        expect(isExpandableTool('read')).toBe(false);
        expect(isExpandableTool('skill')).toBe(false);
    });

    test('expands built-in tools without direct navigation', () => {
        expect(isExpandableTool('grep')).toBe(true);
        expect(isExpandableTool('webfetch')).toBe(true);
        expect(isExpandableTool('todowrite')).toBe(true);
        expect(isExpandableTool('plan_exit')).toBe(true);
    });

    test('expands custom and MCP tools', () => {
        expect(isExpandableTool('linear_list_issues')).toBe(true);
        expect(isExpandableTool('my-plugin_publish')).toBe(true);
        expect(isStaticTool('linear_list_issues')).toBe(false);
    });

    test('normalizes dotted and indexed tool names', () => {
        expect(isStaticTool('runtime.read:2')).toBe(true);
        expect(isExpandableTool('runtime.custom_tool:2')).toBe(true);
    });

    test('does not treat meta tools as expandable', () => {
        expect(isExpandableTool('meta_search')).toBe(false);
        expect(isExpandableTool('meta_use')).toBe(false);
        expect(isExpandableTool('skill_search')).toBe(false);
    });
});

describe('isMetaTool', () => {
    test('returns true for skill_search', () => {
        expect(isMetaTool('skill_search')).toBe(true);
    });

    test('returns true for meta_search', () => {
        expect(isMetaTool('meta_search')).toBe(true);
    });

    test('returns true for meta_use', () => {
        expect(isMetaTool('meta_use')).toBe(true);
    });

    test('returns false for bash', () => {
        expect(isMetaTool('bash')).toBe(false);
    });

    test('returns false for edit', () => {
        expect(isMetaTool('edit')).toBe(false);
    });

    test('returns false for null', () => {
        expect(isMetaTool(null)).toBe(false);
    });

    test('returns false for number', () => {
        expect(isMetaTool(123)).toBe(false);
    });
});
