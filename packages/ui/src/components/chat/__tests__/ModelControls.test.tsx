import { mock } from 'bun:test';
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Mock all store/hook dependencies ──

mock.module('@/lib/i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

mock.module('@/hooks/useOpenCodeReadiness', () => ({
    useOpenCodeReadiness: () => ({ isReady: true, isUnavailable: false }),
}));

const configStoreState = {
    providers: [],
    currentProviderId: null,
    currentModelId: null,
    currentVariant: null,
    currentAgentName: 'default',
    settingsDefaultVariant: null,
    settingsDefaultAgent: null,
    setProvider: () => {},
    setSelectedProvider: () => {},
    setModel: () => {},
    setCurrentVariant: () => {},
    getCurrentModelVariants: () => [],
    setAgent: () => {},
    getCurrentProvider: () => null,
    getModelMetadata: () => null,
    getCurrentAgent: () => null,
    getVisibleAgents: () => [],
    agents: [],
    providerConfigs: {},
    getProviderByModel: () => null,
    editPermission: null,
    editMode: null,
    modelsMetadata: {},
};
mock.module('@/stores/useConfigStore', () => ({
    useConfigStore: Object.assign(
        (selector: (state: any) => any) => selector(configStoreState),
        { getState: () => configStoreState },
    ),
}));

mock.module('@/stores/contextStore', () => ({
    useContextStore: (selector: (state: any) => any) => {
        const state = {};
        return selector(state);
    },
}));

mock.module('@/sync/session-ui-store', () => ({
    useSessionUIStore: (selector: (state: any) => any) => {
        const state = {
            currentSessionId: 'test-session',
            isStreaming: false,
        };
        return selector(state);
    },
}));

mock.module('@/sync/selection-store', () => ({
    useSelectionStore: (selector: (state: any) => any) => {
        const state = {
            sessionAgentSelections: new Map(),
            getSessionModelSelection: () => null,
            setSessionModelSelection: () => {},
            getSessionAgentSelection: () => null,
            setSessionAgentSelection: () => {},
            providerIdBySession: {},
        };
        return selector(state);
    },
}));

mock.module('@/sync/sync-context', () => ({
    useDirectorySync: () => null,
    useSessionMessages: () => [],
}));

mock.module('@/sync/use-sync', () => ({
    useSync: () => null,
}));

mock.module('@/sync/materialization', () => ({
    getSessionMaterializationStatus: () => 'idle',
}));

mock.module('@/stores/useUIStore', () => ({
    useUIStore: (selector: (state: any) => any) => {
        const state = { isMobile: false, shortcutOverrides: {} };
        return selector(state);
    },
}));

mock.module('@/hooks/useModelLists', () => ({
    useModelLists: () => ({
        providers: [],
        models: [],
        isLoading: false,
        error: null,
    }),
}));

mock.module('@/hooks/useIsTextTruncated', () => ({
    useIsTextTruncated: () => false,
}));

mock.module('@/hooks/useRuntimeAPIs', () => ({
    useIsVSCodeRuntime: () => false,
}));

mock.module('@/lib/desktop', () => ({
    isDesktopShell: () => false,
}));

mock.module('@/lib/device', () => ({
    useDeviceInfo: () => ({ isMobile: false, isTablet: false, hasTouchInput: false }),
}));

mock.module('@/lib/modelMetadata', () => ({
    mergeModelMetadataWithLiveModel: () => null,
}));

mock.module('@/lib/modelDisplay', () => ({
    getModelDisplayName: () => 'Test Model',
}));

mock.module('@/lib/permissions/editModeColors', () => ({
    getEditModeColors: () => ({ background: '', border: '', text: '', icon: '' }),
}));

mock.module('@/lib/agentColors', () => ({
    getAgentColor: () => ({ var: '--test', class: 'test' }),
}));

mock.module('@/lib/shortcuts', () => ({
    eventMatchesShortcut: () => false,
    getEffectiveShortcutCombo: () => null,
    normalizeCombo: () => null,
}));

mock.module('@/lib/startupTrace', () => ({
    markStartupTrace: () => {},
}));

mock.module('@/components/icon/Icon', () => ({
    Icon: ({ name, className }: { name: string; className?: string }) =>
        React.createElement('svg', { className, 'data-icon': name }),
}));

mock.module('@/components/ui/ScrollableOverlay', () => ({
    ScrollableOverlay: React.forwardRef((props: any, _ref: any) =>
        React.createElement('div', { 'data-testid': props['data-testid'], className: props.className }, props.children)),
}));

mock.module('@/components/ui/dropdown-menu', () => {
    const DropdownMenu = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-dropdown': true }, children);
    const DropdownMenuTrigger = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-trigger': true }, children);
    const DropdownMenuContent = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-content': true }, children);
    const DropdownMenuItem = ({ children, onSelect, className }: any) =>
        React.createElement('div', { className, onClick: onSelect }, children);
    const DropdownMenuLabel = ({ children }: any) => React.createElement('div', null, children);
    const DropdownMenuSeparator = () => React.createElement('div', null);
    return { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator };
});

mock.module('@/components/ui/input', () => ({
    Input: (props: any) => React.createElement('input', props),
}));

mock.module('@/components/ui/MobileOverlayPanel', () => ({
    MobileOverlayPanel: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

mock.module('@/components/ui/ProviderLogo', () => ({
    ProviderLogo: () => React.createElement('div', null),
}));

mock.module('@/components/ui/tooltip', () => {
    const Tooltip = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
    const TooltipContent = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
    const TooltipTrigger = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
    return { Tooltip, TooltipContent, TooltipTrigger };
});

mock.module('@/components/model-picker/ModelPickerList', () => ({
    ModelPickerList: () => React.createElement('div', null),
}));

import { ModelControls } from '@/components/chat/ModelControls';

describe('ModelControls', () => {
    test('renders ScrollableOverlay with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            React.createElement(ModelControls, {})
        );

        expect(markup).toContain('data-testid="chat-container"');
    });
});
