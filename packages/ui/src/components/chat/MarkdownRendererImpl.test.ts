import { describe, expect, mock, test } from 'bun:test';

// --- Module mocks ----------------------------------------------------------
// Bun's `mock.module` must be registered BEFORE any module in the SUT's
// transitive closure is loaded. These registrations therefore appear at the
// very top of the file, ahead of the static imports below.
//
// The annotation gate in `useFileReferenceInteractions` decides whether an
// outside-workspace file link is granted optimistically (no `/api/fs/stat`
// probe) or must first pass through `fileReferenceExists`. The VSCode runtime
// with an `editor` cannot `stat` paths outside its workspace (403), so the gate
// must ALSO grant optimistically for `(isVSCodeRuntime() && editor)` — matching
// the existing `editor.openFile` click path — otherwise the link stays inert.
//
// NOTE: `@/lib/desktop` is deliberately NOT mocked. Its real functions read
// the runtime registry (`registerRuntimeAPIs`) and window globals
// (`__OPENCHAMBER_ELECTRON__`, `__OPENCHAMBER_LOCAL_ORIGIN__`) exactly like
// the production runtime, so the per-test `applyFlags` helper controls the
// three gates without fighting bun's module-graph resolution.

mock.module('@/lib/runtimeSurface', () => ({
    isMobileSurfaceRuntime: () => false,
}));
mock.module('@/hooks/useEffectiveDirectory', () => ({
    useEffectiveDirectory: () => '/tmp/workspace',
}));
mock.module('@/lib/outsideFileGrants', () => ({
    ensureOutsideFileGrantForDesktop: async () => {},
}));
mock.module('./appLinkInteractions', () => ({
    attachAppLinkInteractions: () => () => {},
}));

const fileReferenceExistsSpy = mock(async () => false);
mock.module('./fileReferenceStat', () => ({
    // The component imports a live getter so every call goes through the
    // current test's spy implementation (module-level spy identity changes
    // are not enough — the closure in `annotateFileLinks` re-reads the export).
    get fileReferenceExists() {
        return fileReferenceExistsSpy;
    },
}));

mock.module('./markdown/markdownCore', () => ({
    renderMarkdownSync: (): string => '<p>[report](/srv/archive/report.txt)</p>',
    renderMarkdownBlocks: async (
        _text: string,
        _streaming: boolean,
        _imageMode: string,
    ): Promise<Array<{ id: string; html: string }>> => [
        {
            id: 'block-1',
            html: '<p>[report](/srv/archive/report.txt)</p>',
        },
    ],
}));
mock.module('./markdown/markdownTheme', () => ({
    ensureMarkdownShikiTheme: () => {},
}));
mock.module('morphdom', () => ({ default: () => {} }));
mock.module('./markdown/decorate', () => ({
    attachMarkdownInteractions: () => () => {},
    applyMarkdownCodeBlockWrapState: () => {},
    decorateMarkdown: () => {},
    getMarkdownCodeText: (element: { textContent?: string }) => element.textContent ?? '',
}));

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { I18nProvider } from '@/lib/i18n';
import { RuntimeAPIContext } from '@/contexts/runtimeAPIContext';
import { registerRuntimeAPIs } from '@/contexts/runtimeAPIRegistry';
import type { RuntimeAPIs } from '@/lib/api/types';

import { localPathFromFileUrl, parseFileReference, type ParsedFileReference } from './fileReferenceParser';

const parse = (value: string): ParsedFileReference | null => parseFileReference(value);

describe('parseFileReference', () => {
    test('returns null for empty or whitespace input', () => {
        expect(parse('')).toBeNull();
        expect(parse('   ')).toBeNull();
    });

    test('parses bare path', () => {
        expect(parse('src/foo.ts')).toEqual({ path: 'src/foo.ts' });
    });

    test('parses path with single line', () => {
        expect(parse('src/foo.ts:42')).toEqual({ path: 'src/foo.ts', line: 42 });
    });

    test('parses path with line and column', () => {
        expect(parse('src/foo.ts:42:8')).toEqual({ path: 'src/foo.ts', line: 42, column: 8 });
    });

    test('parses path with line range', () => {
        expect(parse('src/foo.ts:42-58')).toEqual({
            path: 'src/foo.ts',
            line: 42,
            endLine: 58,
        });
    });

    test('parses path with single-line range (start equals end)', () => {
        expect(parse('src/foo.ts:10-10')).toEqual({
            path: 'src/foo.ts',
            line: 10,
            endLine: 10,
        });
    });

    test('rejects range with end before start', () => {
        expect(parse('src/foo.ts:20-10')).toBeNull();
    });

    test('falls back to path-only when range endpoint is non-numeric', () => {
        // `src/foo.ts:10-abc` and `src/foo.ts:abc-20` are malformed; the
        // line info is discarded and only the path is returned (the trailing
        // `:`-suffix is stripped).
        expect(parse('src/foo.ts:10-abc')).toEqual({ path: 'src/foo.ts' });
        expect(parse('src/foo.ts:abc-20')).toEqual({ path: 'src/foo.ts' });
    });

    test('strips backtick and quote wrapping from range forms', () => {
        expect(parse('`src/foo.ts:10-20`')).toEqual({
            path: 'src/foo.ts',
            line: 10,
            endLine: 20,
        });
        expect(parse('"src/foo.ts:1-3"')).toEqual({
            path: 'src/foo.ts',
            line: 1,
            endLine: 3,
        });
    });

    test('parses absolute Windows path with line range', () => {
        expect(parse('C:/repo/src/foo.ts:5-9')).toEqual({
            path: 'C:/repo/src/foo.ts',
            line: 5,
            endLine: 9,
        });
    });

    test('preserves line:col form (does not interpret as range)', () => {
        expect(parse('src/foo.ts:42:8')).toEqual({
            path: 'src/foo.ts',
            line: 42,
            column: 8,
        });
    });

    test('preserves hash form', () => {
        expect(parse('src/foo.ts#L42C8')).toEqual({
            path: 'src/foo.ts',
            line: 42,
            column: 8,
        });
        expect(parse('src/foo.ts#L42')).toEqual({
            path: 'src/foo.ts',
            line: 42,
        });
    });

    test('range form takes precedence over line-only when suffix matches digits-dash-digits', () => {
        const result = parse('src/foo.ts:42-58');
        expect(result).toEqual({ path: 'src/foo.ts', line: 42, endLine: 58 });
    });
});

describe('localPathFromFileUrl', () => {
    test('converts local file URLs to absolute paths', () => {
        expect(localPathFromFileUrl('file:///private/tmp/report%20viewer.html')).toBe('/private/tmp/report viewer.html');
        expect(localPathFromFileUrl('file://localhost/private/tmp/REPORT.md')).toBe('/private/tmp/REPORT.md');
        expect(localPathFromFileUrl('file:///C:/Users/test/report.html')).toBe('C:/Users/test/report.html');
    });

    test('rejects non-file URLs and remote file hosts', () => {
        expect(localPathFromFileUrl('https://example.com/report.html')).toBeNull();
        expect(localPathFromFileUrl('file://remote-host/share/report.html')).toBeNull();
        expect(localPathFromFileUrl('file:///tmp/bad%ZZpath')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Render-level behavior tests for file-link annotation
// ---------------------------------------------------------------------------
//
// These tests mount the real `MarkdownRendererImpl` against a minimal
// document/window stub (Bun's test runner does not provide a DOM by default),
// mock the render pipeline (markdownCore/morphdom/decorate) so the SUT renders
// deterministically, and assert BEHAVIOR only.

// --- Minimal DOM stub (extended from the number-input pattern) --------------

class FakeElement {
    nodeType = 1;
    nodeName: string;
    tagName: string;
    ownerDocument: FakeDocument;
    parentNode: FakeElement | null = null;
    childNodes: FakeElement[] = [];
    textContent = '';
    innerHTML = '';
    style: Record<string, unknown> = {
        setProperty() {},
        getPropertyValue() { return ''; },
        display: '',
    };
    classList = {
        add() {},
        remove() {},
        contains() { return false; },
        toggle() {},
        toString() { return ''; },
    };
    private readonly attributes = new Map<string, string>();
    private readonly eventListeners = new Map<string, Array<(event: unknown) => void>>();

    constructor(tag: string, ownerDocument: FakeDocument) {
        this.nodeName = tag.toUpperCase();
        this.tagName = tag.toUpperCase();
        this.ownerDocument = ownerDocument;
    }

    get children(): FakeElement[] {
        return this.childNodes;
    }

    setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
    }
    getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
    }
    hasAttribute(name: string): boolean {
        return this.attributes.has(name);
    }
    removeAttribute(name: string): void {
        this.attributes.delete(name);
    }
    appendChild(child: FakeElement): FakeElement {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
    }
    insertBefore(child: FakeElement, ref: FakeElement | null): FakeElement {
        const index = ref ? this.childNodes.indexOf(ref) : -1;
        if (index < 0) {
            this.childNodes.push(child);
        } else {
            this.childNodes.splice(index, 0, child);
        }
        child.parentNode = this;
        return child;
    }
    removeChild(child: FakeElement): FakeElement {
        const index = this.childNodes.indexOf(child);
        if (index >= 0) {
            this.childNodes.splice(index, 1);
        }
        child.parentNode = null;
        return child;
    }
    remove(): void {
        this.parentNode?.removeChild(this);
    }
    contains(node: FakeElement): boolean {
        let current: FakeElement | null = node;
        while (current) {
            if (current === this) {
                return true;
            }
            current = current.parentNode;
        }
        return false;
    }
    closest(selector: string): FakeElement | null {
        let current: FakeElement | null = this;
        while (current) {
            if (current.matches(selector)) {
                return current;
            }
            current = current.parentNode;
        }
        return null;
    }
    matches(selector: string): boolean {
        if (selector === 'a' || selector === 'A') {
            return this.tagName === 'A';
        }
        const attributeMatch = selector.match(/^\[([\w-]+)="([^"]*)"\]$/);
        if (attributeMatch) {
            return this.getAttribute(attributeMatch[1] ?? '') === (attributeMatch[2] ?? '');
        }
        return false;
    }
    querySelector(selector: string): FakeElement | null {
        return this.querySelectorAll(selector)[0] ?? null;
    }
    querySelectorAll(selector: string): FakeElement[] {
        if (selector.includes('data-openchamber-block-path-token')) {
            return (this as unknown as { __fileLinkCandidates?: FakeElement[] }).__fileLinkCandidates ?? [];
        }
        if (selector === '[data-markdown-content]') {
            const results: FakeElement[] = [];
            const visit = (node: FakeElement): void => {
                for (const child of node.childNodes) {
                    if (child.hasAttribute('data-markdown-content')) {
                        results.push(child);
                    }
                    visit(child);
                }
            };
            visit(this);
            return results;
        }
        return [];
    }
    addEventListener(type: string, listener: (event: unknown) => void): void {
        const listeners = this.eventListeners.get(type) ?? [];
        listeners.push(listener);
        this.eventListeners.set(type, listeners);
    }
    removeEventListener(type: string, listener: (event: unknown) => void): void {
        const listeners = this.eventListeners.get(type) ?? [];
        this.eventListeners.set(type, listeners.filter((l) => l !== listener));
    }
    listenersFor(type: string): Array<(event: unknown) => void> {
        return this.eventListeners.get(type) ?? [];
    }
    focus() {}
    blur() {}
    click() {}
    isEqualNode(): boolean {
        return false;
    }
    cloneNode(): FakeElement {
        return this;
    }
}

interface FakeDocument extends FakeElement {
    defaultView: FakeWindow;
    body: FakeElement;
    documentElement: FakeElement;
    createElement(tag: string): FakeElement;
    createElementNS(_: string, tag: string): FakeElement;
    createTextNode(text: string): { nodeType: number; nodeName: string; textContent: string; parentNode: null };
    activeElement: FakeElement | null;
    HTMLIFrameElement: unknown;
    HTMLFrameSetElement: unknown;
    HTMLInputElement: unknown;
    HTMLTextAreaElement: unknown;
    HTMLSelectElement: unknown;
    HTMLOptionElement: unknown;
    HTMLAnchorElement: unknown;
}

interface FakeWindow {
    document: FakeDocument;
    navigator: { userAgent: string; platform: string; maxTouchPoints: number };
    matchMedia(_: string): { matches: boolean; addEventListener(): void; removeEventListener(): void };
    addEventListener(): void;
    removeEventListener(): void;
    setTimeout(callback: () => void): number;
    clearTimeout(): void;
    requestAnimationFrame(callback: () => void): number;
    innerWidth: number;
    screen: { width: number };
    location: { search: string; origin: string };
    localStorage: { getItem(): null; setItem(): void; removeItem(): void };
    __OPENCHAMBER_ELECTRON__?: { runtime?: string };
    __OPENCHAMBER_LOCAL_ORIGIN__?: string;
    __OPENCHAMBER_API_BASE_URL__?: string;
    HTMLIFrameElement: unknown;
    HTMLFrameSetElement: unknown;
    HTMLInputElement: unknown;
    HTMLTextAreaElement: unknown;
    HTMLSelectElement: unknown;
    HTMLOptionElement: unknown;
    HTMLAnchorElement: unknown;
}

let pendingTimers: Array<() => void> = [];

function installDomStub(): { document: FakeDocument; restore: () => void } {
    const document = new FakeElement('#document', null as unknown as FakeDocument) as FakeDocument;
    document.nodeType = 9;
    document.nodeName = '#document';
    document.tagName = '#document';

    const window: FakeWindow = {
        document,
        navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0 },
        matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
        addEventListener() {},
        removeEventListener() {},
        setTimeout(callback: () => void): number {
            pendingTimers.push(callback);
            return pendingTimers.length;
        },
        clearTimeout() {},
        requestAnimationFrame(callback: () => void): number {
            callback();
            return 1;
        },
        innerWidth: 1280,
        screen: { width: 1280 },
        location: { search: '', origin: 'http://localhost:3000' },
        localStorage: {
            getItem() { return null; },
            setItem() {},
            removeItem() {},
        },
        __OPENCHAMBER_ELECTRON__: undefined,
        __OPENCHAMBER_LOCAL_ORIGIN__: undefined,
        __OPENCHAMBER_API_BASE_URL__: undefined,
        HTMLIFrameElement: FakeElement,
        HTMLFrameSetElement: FakeElement,
        HTMLInputElement: FakeElement,
        HTMLTextAreaElement: FakeElement,
        HTMLSelectElement: FakeElement,
        HTMLOptionElement: FakeElement,
        HTMLAnchorElement: FakeElement,
    };
    document.defaultView = window;
    document.body = new FakeElement('body', document);
    document.documentElement = new FakeElement('html', document);
    document.createElement = (tag: string) => new FakeElement(tag, document);
    document.createElementNS = (_: string, tag: string) => new FakeElement(tag, document);
    document.createTextNode = (text: string) => ({
        nodeType: 3,
        nodeName: '#text',
        textContent: text,
        parentNode: null,
    });
    document.activeElement = null;
    document.HTMLIFrameElement = FakeElement;
    document.HTMLFrameSetElement = FakeElement;
    document.HTMLInputElement = FakeElement;
    document.HTMLTextAreaElement = FakeElement;
    document.HTMLSelectElement = FakeElement;
    document.HTMLOptionElement = FakeElement;
    document.HTMLAnchorElement = FakeElement;

    const g = globalThis as Record<string, unknown>;
    const previous = {
        document: g.document,
        window: g.window,
        navigator: g.navigator,
        Element: g.Element,
        HTMLElement: g.HTMLElement,
        MutationObserver: g.MutationObserver,
        IS_REACT_ACT_ENVIRONMENT: g.IS_REACT_ACT_ENVIRONMENT,
    };

    g.IS_REACT_ACT_ENVIRONMENT = true;
    g.document = document;
    g.window = window;
    g.navigator = window.navigator;
    g.Element = FakeElement;
    g.HTMLElement = FakeElement;
    g.MutationObserver = class {
        observe() {}
        disconnect() {}
        takeRecords() { return []; }
    };
    pendingTimers = [];

    return {
        document,
        restore() {
            g.document = previous.document;
            g.window = previous.window;
            g.navigator = previous.navigator;
            g.Element = previous.Element;
            g.HTMLElement = previous.HTMLElement;
            g.MutationObserver = previous.MutationObserver;
            g.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
            pendingTimers = [];
        },
    };
}

// --- Mount harness ---------------------------------------------------------

const editor = {
    openFile: mock(async () => {}),
};

const { MarkdownRenderer } = await import('./MarkdownRendererImpl');

interface MountedRenderer {
    outer: FakeElement;
    content: FakeElement;
    anchor: FakeElement;
    flush(): Promise<void>;
    clickFileLink(): void;
    unmount(): void;
}

async function mountMarkdownRenderer(content: string, href: string): Promise<MountedRenderer> {
    const doc = (globalThis as unknown as { document: FakeDocument }).document;
    const host = doc.createElement('div');
    const root: Root = createRoot(host as unknown as Element);
    const apis = {
        editor,
        runtime: {
            isVSCode: (globalThis as unknown as { __openchamberTestVSCode?: boolean }).__openchamberTestVSCode === true,
        },
    } as unknown as RuntimeAPIs;

    act(() => {
        root.render(
            React.createElement(
                I18nProvider,
                null,
                React.createElement(
                    RuntimeAPIContext.Provider,
                    { value: apis },
                    React.createElement(MarkdownRenderer, {
                        content,
                        messageId: 'm1',
                        isAnimated: false,
                    }),
                ),
            ),
        );
    });
    // Settle the mocked async render pipeline before the annotation flush.
    await act(async () => {
        await Promise.resolve();
    });

    const outer = host.childNodes[0] as FakeElement;
    const contentElement = outer.childNodes[0] as FakeElement;
    const anchor = doc.createElement('a');
    anchor.setAttribute('href', href);
    anchor.textContent = 'report';
    contentElement.appendChild(anchor);
    // `annotateFileLinks` queries the ref'd container (the outer div), so the
    // candidate must be discoverable from that node.
    (outer as unknown as { __fileLinkCandidates: FakeElement[] }).__fileLinkCandidates = [anchor];

    return {
        outer,
        content: contentElement,
        anchor,
        async flush() {
            const timers = [...pendingTimers];
            pendingTimers = [];
            for (const timer of timers) {
                timer();
            }
            // Drain the annotation `.then` microtask by yielding real macrotask turns.
            await new Promise((resolve) => setTimeout(resolve, 0));
            await act(async () => {});
            await new Promise((resolve) => setTimeout(resolve, 0));
        },
        clickFileLink() {
            const event = { target: anchor, preventDefault() {}, stopPropagation() {} };
            for (const handler of outer.listenersFor('click')) {
                handler(event);
            }
        },
        unmount() {
            act(() => {
                root.unmount();
            });
        },
    };
}

async function withMarkdownRenderer<T>(
    flags: { isVSCode: boolean; isDesktopShell?: boolean; isDesktopLocalOriginActive?: boolean },
    content: string,
    href: string,
    body: (mounted: MountedRenderer) => Promise<T> | T,
): Promise<T> {
    // Control the real desktop gates the way the production runtime does:
    // - VSCode flag via the runtime registry
    // - Electron shell via the window __OPENCHAMBER_ELECTRON__ global
    // - Local origin via the __OPENCHAMBER_LOCAL_ORIGIN__ / API-base globals
    const g = globalThis as Record<string, unknown>;
    (g as { __openchamberTestVSCode?: boolean }).__openchamberTestVSCode = flags.isVSCode;
    registerRuntimeAPIs({
        runtime: {
            isVSCode: flags.isVSCode,
            platform: flags.isVSCode ? 'vscode' : 'web',
        },
        editor,
    } as unknown as RuntimeAPIs);

    fileReferenceExistsSpy.mockClear();
    fileReferenceExistsSpy.mockImplementation(async () => false);
    editor.openFile.mockClear();
    const stub = installDomStub();
    stub.document.defaultView.__OPENCHAMBER_ELECTRON__ = flags.isDesktopShell
        ? { runtime: 'electron' }
        : undefined;
    stub.document.defaultView.__OPENCHAMBER_LOCAL_ORIGIN__ = flags.isDesktopShell && flags.isDesktopLocalOriginActive
        ? 'http://localhost:3456'
        : undefined;
    stub.document.defaultView.__OPENCHAMBER_API_BASE_URL__ = flags.isDesktopShell && flags.isDesktopLocalOriginActive
        ? 'http://localhost:3456'
        : undefined;
    stub.document.defaultView.location.origin = flags.isDesktopShell && flags.isDesktopLocalOriginActive
        ? 'http://localhost:3456'
        : 'http://localhost:3000';

    const mounted = await mountMarkdownRenderer(content, href);
    try {
        return await body(mounted);
    } finally {
        try { mounted.unmount(); } catch { /* ignore */ }
        registerRuntimeAPIs(null);
        delete (g as { __openchamberTestVSCode?: boolean }).__openchamberTestVSCode;
        stub.restore();
    }
}

describe('MarkdownRendererImpl file-link annotation (VSCode runtime rescue)', () => {
    test('VSCode+editor: outside-workspace link is annotated optimistically without a stat probe', async () => {
        await withMarkdownRenderer(
            { isVSCode: true, isDesktopShell: false, isDesktopLocalOriginActive: false },
            '[report](/srv/archive/report.txt)',
            'file:///srv/archive/report.txt',
async (mounted) => {
                await mounted.flush();
                expect(fileReferenceExistsSpy).not.toHaveBeenCalled();
                expect(mounted.anchor.getAttribute('data-openchamber-file-link')).toBe('true');
                expect(mounted.anchor.getAttribute('data-openchamber-file-path')).toBe('/srv/archive/report.txt');
            },
        );
    });

    test('VSCode+editor: clicking the annotated outside link calls editor.openFile with the resolved path', async () => {
        await withMarkdownRenderer(
            { isVSCode: true, isDesktopShell: false, isDesktopLocalOriginActive: false },
            '[report](/srv/archive/report.txt)',
            'file:///srv/archive/report.txt',
            async (mounted) => {
                await mounted.flush();
                expect(mounted.anchor.getAttribute('data-openchamber-file-link')).toBe('true');
                mounted.clickFileLink();
                expect(editor.openFile).toHaveBeenCalledWith('/srv/archive/report.txt', undefined, undefined);
            },
        );
    });

    test('VSCode+editor: workspace-internal link is still annotated and still stat-probed', async () => {
        await withMarkdownRenderer(
            { isVSCode: true, isDesktopShell: false, isDesktopLocalOriginActive: false },
            '[inside](/tmp/workspace/inside.txt)',
            'file:///tmp/workspace/inside.txt',
            async (mounted) => {
                // `withMarkdownRenderer` resets the spy to the default
                // (exists=false) impl; set the desired impl after that reset.
                fileReferenceExistsSpy.mockImplementation(async () => true);
                await mounted.flush();
                expect(mounted.outer.contains(mounted.anchor)).toBe(true);
                expect(fileReferenceExistsSpy).toHaveBeenCalledWith('/tmp/workspace/inside.txt', '/tmp/workspace');
                expect(mounted.anchor.getAttribute('data-openchamber-file-link')).toBe('true');
            },
        );
    });

    test('web runtime: outside-workspace link is stat-probed and left unannotated when the file is absent', async () => {
        await withMarkdownRenderer(
            { isVSCode: false, isDesktopShell: false, isDesktopLocalOriginActive: false },
            '[report](/srv/archive/report.txt)',
            'file:///srv/archive/report.txt',
            async (mounted) => {
                await mounted.flush();
                expect(fileReferenceExistsSpy).toHaveBeenCalledWith('/srv/archive/report.txt', '/tmp/workspace');
                expect(mounted.anchor.getAttribute('data-openchamber-file-link')).toBeNull();
            },
        );
    });

    test('electron desktop: outside-workspace link is still granted optimistically without a stat probe', async () => {
        await withMarkdownRenderer(
            { isVSCode: false, isDesktopShell: true, isDesktopLocalOriginActive: true },
            '[report](/srv/archive/report.txt)',
            'file:///srv/archive/report.txt',
            async (mounted) => {
                await mounted.flush();
                expect(fileReferenceExistsSpy).not.toHaveBeenCalled();
                expect(mounted.anchor.getAttribute('data-openchamber-file-link')).toBe('true');
            },
        );
    });
});
