import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('@/sync/session-ui-store', () => ({
    useSessionUIStore: (selector: (state: any) => any) => {
        const state = {
            currentSessionId: 'test-session',
        };
        return selector(state);
    },
}));

mock.module('@/sync/sync-context', () => ({
    useSessions: () => [],
}));

mock.module('@/sync/session-actions', () => ({
    respondToPermission: async () => {},
}));

mock.module('@/contexts/useThemeSystem', () => ({
    useThemeSystem: () => ({
        currentTheme: {
            metadata: { id: 'light', name: 'Light', description: '', version: '1', variant: 'light', tags: [] },
            colors: {
                primary: { base: '#000', foreground: '#fff' },
                surface: { background: '#fff', foreground: '#000', muted: '#f0f0f0', mutedForeground: '#666', elevated: '#fff', elevatedForeground: '#000', overlay: '#000', subtle: '#f5f5f5' },
                interactive: { border: '#ccc', borderHover: '#999', borderFocus: '#666', selection: '#007aff', selectionForeground: '#fff', focusRing: '#007aff', hover: '#e8e8e8' },
                status: {
                    error: '#ff3b30', errorForeground: '#fff', errorBackground: '#ffeeed', errorBorder: '#ff3b30',
                    warning: '#ff9500', warningForeground: '#fff', warningBackground: '#fff4e5', warningBorder: '#ff9500',
                    success: '#34c759', successForeground: '#fff', successBackground: '#e8f8ee', successBorder: '#34c759',
                    info: '#007aff', infoForeground: '#fff', infoBackground: '#e5f2ff', infoBorder: '#007aff',
                },
                syntax: {
                    base: { background: '#fff', foreground: '#000', keyword: '#000', string: '#000', number: '#000', function: '#000', variable: '#000', type: '#000', comment: '#000', operator: '#000' },
                    highlights: { diffAdded: '#00ff00', diffRemoved: '#ff0000', lineNumber: '#ccc' },
                },
            },
        } as any,
        availableThemes: [],
        setTheme: () => {},
        customThemesLoading: false,
        reloadCustomThemes: async () => {},
        isSystemPreference: false,
        setSystemPreference: () => {},
        themeMode: 'light',
        setThemeMode: () => {},
        lightThemeId: 'light',
        darkThemeId: 'dark',
        setLightThemePreference: () => {},
        setDarkThemePreference: () => {},
    }),
}));

import { I18nProvider } from '@/lib/i18n';
import { PermissionCard } from '@/components/chat/PermissionCard';

describe('PermissionCard', () => {
    test('renders data-testid on ScrollableOverlay instances for edit tool', () => {
        const permission = {
            id: 'perm-1',
            sessionID: 'ses-1',
            permission: 'edit',
            patterns: ['**/*.ts'],
            metadata: {
                changes: '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new',
            },
            always: [],
        };

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <PermissionCard permission={permission as any} />
            </I18nProvider>
        );

        // The edit tool branch renders a ScrollableOverlay with data-testid="tool-part"
        expect(markup).toContain('data-testid="tool-part"');
    });

    test('renders data-testid on ScrollableOverlay instances for generic tool with metadata', () => {
        const permission = {
            id: 'perm-2',
            sessionID: 'ses-1',
            permission: 'custom_tool',
            patterns: [],
            metadata: {
                action: 'deploy',
                description: 'Deploy to production',
                extra: 'some-value',
            },
            always: [],
        };

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <PermissionCard permission={permission as any} />
            </I18nProvider>
        );

        // Generic tool with action and extra metadata should have 2 ScrollableOverlays
        expect(markup).toContain('data-testid="tool-part"');
    });
});
