import { describe, expect, test } from 'bun:test';

import { isMetaTool } from './toolRenderUtils';

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
