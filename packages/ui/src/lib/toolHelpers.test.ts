import { describe, expect, test } from 'bun:test';

import { getToolMetadata, TOOL_METADATA } from './toolHelpers';

describe('TOOL_METADATA - meta tools', () => {
    test('skill_search entry exists with correct displayName', () => {
        const meta = TOOL_METADATA['skill_search'];
        expect(meta).toBeDefined();
        expect(meta.displayName).toBe('Skill Search');
    });

    test('skill_search entry has category ai', () => {
        const meta = TOOL_METADATA['skill_search'];
        expect(meta.category).toBe('ai');
    });

    test('skill_search entry has inputFields', () => {
        const meta = TOOL_METADATA['skill_search'];
        expect(meta.inputFields).toBeDefined();
        expect(meta.inputFields!.length).toBeGreaterThan(0);
        // Should have a query field
        expect(meta.inputFields!.some(f => f.key === 'query')).toBe(true);
    });

    test('tool_search entry exists with correct displayName', () => {
        const meta = TOOL_METADATA['tool_search'];
        expect(meta).toBeDefined();
        expect(meta.displayName).toBe('Tool Search');
    });

    test('tool_search entry has category ai', () => {
        const meta = TOOL_METADATA['tool_search'];
        expect(meta.category).toBe('ai');
    });

    test('tool_search entry has inputFields with query field', () => {
        const meta = TOOL_METADATA['tool_search'];
        expect(meta.inputFields).toBeDefined();
        expect(meta.inputFields!.length).toBeGreaterThan(0);
        expect(meta.inputFields!.some(f => f.key === 'query')).toBe(true);
    });

    test('tool_use entry exists with correct displayName', () => {
        const meta = TOOL_METADATA['tool_use'];
        expect(meta).toBeDefined();
        expect(meta.displayName).toBe('Tool Use');
    });

    test('tool_use entry has category ai', () => {
        const meta = TOOL_METADATA['tool_use'];
        expect(meta.category).toBe('ai');
    });

    test('tool_use entry has inputFields with tool and args fields', () => {
        const meta = TOOL_METADATA['tool_use'];
        expect(meta.inputFields).toBeDefined();
        expect(meta.inputFields!.length).toBeGreaterThan(0);
        expect(meta.inputFields!.some(f => f.key === 'tool')).toBe(true);
        expect(meta.inputFields!.some(f => f.key === 'args')).toBe(true);
    });
});

describe('TOOL_METADATA - existing entries unchanged', () => {
    test('read entry unchanged', () => {
        expect(TOOL_METADATA['read'].displayName).toBe('Read File');
        expect(TOOL_METADATA['read'].category).toBe('file');
    });

    test('write entry unchanged', () => {
        expect(TOOL_METADATA['write'].displayName).toBe('Write File');
        expect(TOOL_METADATA['write'].category).toBe('file');
    });

    test('edit entry unchanged', () => {
        expect(TOOL_METADATA['edit'].displayName).toBe('Edit File');
        expect(TOOL_METADATA['edit'].category).toBe('file');
    });

    test('bash entry unchanged', () => {
        expect(TOOL_METADATA['bash'].displayName).toBe('Shell Command');
        expect(TOOL_METADATA['bash'].category).toBe('system');
    });

    test('task entry unchanged', () => {
        expect(TOOL_METADATA['task'].displayName).toBe('Agent Task');
        expect(TOOL_METADATA['task'].category).toBe('ai');
    });
});

describe('getToolMetadata - meta tools', () => {
    test('returns correct metadata for skill_search', () => {
        const meta = getToolMetadata('skill_search');
        expect(meta.displayName).toBe('Skill Search');
        expect(meta.category).toBe('ai');
    });

    test('returns correct metadata for tool_search', () => {
        const meta = getToolMetadata('tool_search');
        expect(meta.displayName).toBe('Tool Search');
        expect(meta.category).toBe('ai');
    });

    test('returns correct metadata for tool_use', () => {
        const meta = getToolMetadata('tool_use');
        expect(meta.displayName).toBe('Tool Use');
        expect(meta.category).toBe('ai');
    });
});
