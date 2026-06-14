import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Mock all store/hook dependencies ChatMessage relies on ──

mock.module('@/lib/device', () => ({
    useDeviceInfo: () => ({ isMobile: false, isTablet: false, hasTouchInput: false }),
}));

mock.module('@/contexts/useThemeSystem', () => ({
    useThemeSystem: () => ({
        currentTheme: {
            metadata: {
                id: 'light', name: 'Light', description: '', version: '1', variant: 'light', tags: [],
            },
            colors: {
                primary: { base: '#000', foreground: '#fff' },
                surface: {
                    background: '#fff', foreground: '#000', muted: '#f0f0f0', mutedForeground: '#666',
                    elevated: '#fff', elevatedForeground: '#000', overlay: '#000', subtle: '#f5f5f5',
                },
                interactive: {
                    border: '#ccc', borderHover: '#999', borderFocus: '#666', selection: '#007aff',
                    selectionForeground: '#fff', focusRing: '#007aff', hover: '#e8e8e8',
                },
                status: {
                    error: '#ff3b30', errorForeground: '#fff', errorBackground: '#ffeeed', errorBorder: '#ff3b30',
                    warning: '#ff9500', warningForeground: '#fff', warningBackground: '#fff4e5', warningBorder: '#ff9500',
                    success: '#34c759', successForeground: '#fff', successBackground: '#e8f8ee', successBorder: '#34c759',
                    info: '#007aff', infoForeground: '#fff', infoBackground: '#e5f2ff', infoBorder: '#007aff',
                },
                syntax: {
                    base: {
                        background: '#fff', foreground: '#000', keyword: '#000', string: '#000',
                        number: '#000', function: '#000', variable: '#000', type: '#000',
                        comment: '#000', operator: '#000',
                    },
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

mock.module('@/sync/session-ui-store', () => ({
    useSessionUIStore: (selector: (state: any) => any) => {
        const state = {
            currentSessionId: 'test-session',
            revertToMessage: () => {},
            forkFromMessage: () => {},
            worktreeMetadata: new Map(),
            availableWorktreesByProject: new Map(),
        };
        return selector(state);
    },
}));

mock.module('@/sync/selection-store', () => ({
    useSelectionStore: (selector: (state: any) => any) => {
        const state = {
            getAgentModelForSession: () => null,
            getSessionModelSelection: () => null,
        };
        return selector(state);
    },
}));

mock.module('@/stores/useConfigStore', () => ({
    useConfigStore: (selector: (state: any) => any) => {
        const state = { providers: [] };
        return selector(state);
    },
}));

mock.module('@/stores/useFeatureFlagsStore', () => ({
    useFeatureFlagsStore: (selector: (state: any) => any) => {
        const state = { planModeEnabled: false };
        return selector(state);
    },
}));

mock.module('@/stores/useUIStore', () => ({
    useUIStore: (selector: any) => {
        const state = {
            showReasoningTraces: true,
            stickyUserHeader: true,
            chatRenderMode: 'normal',
            showExpandedBashTools: false,
            showExpandedEditTools: false,
        };
        return selector(state);
    },
}));

mock.module('@/stores/contextStore', () => ({
    useContextStore: (selector: (state: any) => any) => {
        const state = {
            currentAgentContext: new Map(),
            sessionAgentSelections: new Map(),
        };
        return selector(state);
    },
}));

import { I18nProvider } from '@/lib/i18n';
import { SyncProvider } from '@/sync/sync-context';
import { RuntimeAPIProvider } from '@/contexts/RuntimeAPIProvider';

const mockSdk = { init: async () => {}, on: () => {} };
const mockDirectory = '/tmp/test';

const mockRuntimeAPIs = {
    runtime: { platform: 'web', isDesktop: false, isVSCode: false },
    terminal: {
        create: async () => ({ sessionId: 'term-1', cols: 80, rows: 24 }),
        resize: async () => {},
        write: async () => {},
        close: async () => {},
        subscribe: () => ({ close: () => {} }),
        stream: () => ({
            [Symbol.asyncIterator]: () => ({
                next: async () => ({ done: true, value: undefined }),
            }),
        }),
        setSessionHandler: () => {},
    },
    git: {
        getStatus: async () => ([]),
        getDiff: async () => '',
        getLog: async () => ([]),
        getBranch: async () => 'main',
        stage: async () => {},
        unstage: async () => {},
        commit: async () => '',
        push: async () => {},
        reset: async () => {},
        discard: async () => {},
    },
    files: {
        readText: async () => '',
        writeText: async () => {},
        readBinary: async () => new Uint8Array(),
        stat: async () => ({ isFile: true, size: 0, mtimeMs: 0 }),
        ls: async () => ([]),
        mkdir: async () => {},
        remove: async () => {},
        rename: async () => {},
        exists: async () => true,
        watch: () => ({ close: () => {} }),
    },
    settings: { get: async () => null, set: async () => {} },
    permissions: {
        requestFilesystem: async () => {},
        requestTerminal: async () => {},
        requestClipboard: async () => {},
        requestNotifications: async () => {},
    },
    notifications: {
        show: async () => {},
        showError: async () => {},
        close: async () => {},
    },
    tools: {
        executeCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    },
} as any;

// Import after mocks are set up
import ChatMessage from './ChatMessage';

describe('ChatMessage', () => {
    const renderWithProviders = (children: React.ReactNode) => {
        return renderToStaticMarkup(
            <RuntimeAPIProvider apis={mockRuntimeAPIs}>
                <I18nProvider>
                    <SyncProvider sdk={mockSdk as any} directory={mockDirectory}>
                        {children}
                    </SyncProvider>
                </I18nProvider>
            </RuntimeAPIProvider>
        );
    };

    test('renders outer message container with data-testid attribute', () => {
        const message = {
            info: {
                id: 'test-msg-1',
                sessionID: 'test-session',
                role: 'user',
                time: { created: 1000000 },
            } as any,
            parts: [{ type: 'text', text: 'Hello' }],
        };

        const markup = renderWithProviders(
            <ChatMessage message={message as any} />
        );

        expect(markup).toContain('data-testid="chat-message"');
    });

    test('renders assistant message container with data-testid', () => {
        const message = {
            info: {
                id: 'test-msg-2',
                sessionID: 'test-session',
                role: 'assistant',
                time: { created: 1000001 },
            } as any,
            parts: [],
        };

        const markup = renderWithProviders(
            <ChatMessage message={message as any} />
        );

        expect(markup).toContain('data-testid="chat-message"');
    });
});
