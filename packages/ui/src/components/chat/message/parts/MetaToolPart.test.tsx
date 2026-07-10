import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { I18nProvider } from '@/lib/i18n';
import { MetaToolPart } from './MetaToolPart';
import type { ToolPart } from '@opencode-ai/sdk/v2';

// ── Factory helpers ──────────────────────────────────────────────────────────

const basePart = (overrides: Partial<ToolPart> = {}): ToolPart =>
    ({
        id: 'meta-tool-1',
        sessionID: 'ses_test',
        messageID: 'msg_test',
        type: 'tool',
        callID: 'call_test',
        tool: 'skill_search',
        ...overrides,
    }) as ToolPart;

const pendingPart = (overrides: Partial<ToolPart> = {}): ToolPart =>
    basePart({
        state: {
            status: 'pending',
        },
        ...overrides,
    });

const runningPart = (overrides: Partial<ToolPart> = {}): ToolPart =>
    basePart({
        state: {
            status: 'running',
            input: { query: 'find-skill' },
            time: { start: Date.now() },
        },
        ...overrides,
    });

const completedPart = (overrides: Partial<ToolPart> = {}): ToolPart =>
    basePart({
        state: {
            status: 'completed',
            input: { query: 'find-skill' },
            output: 'Found skill-coach with 2 matches',
            title: 'Skill Search Complete',
            time: { start: 1000000, end: 1000500 },
        },
        ...overrides,
    });

const errorPart = (overrides: Partial<ToolPart> = {}): ToolPart =>
    basePart({
        state: {
            status: 'error',
            input: { query: 'bad-query' },
            error: 'Failed to search skills: timeout',
            time: { start: 1000000, end: 1003000 },
        },
        ...overrides,
    });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MetaToolPart', () => {
    test('pending state: renders tool name and ellipsis, no expandable content', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={pendingPart()} />
            </I18nProvider>,
        );

        expect(markup).toContain('Skill Search');
        expect(markup).toContain('...');
        // No expandable sections in pending state
        expect(markup).not.toContain('aria-expanded');
    });

    test('running state: renders tool name and spinner, expandable input', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={runningPart()} />
            </I18nProvider>,
        );

        expect(markup).toContain('Skill Search');
        // Should show a button for expandable input
        expect(markup).toContain('role="button"');
        // Should show the input label (running state auto-expands)
        expect(markup).toContain('Input');
        // Should show the input query
        expect(markup).toContain('find-skill');
    });

    test('completed state: renders collapsed by default with tool name and summary in header', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={completedPart()} />
            </I18nProvider>,
        );

        expect(markup).toContain('Skill Search');
        // Summary shown in header title attribute (visible on hover)
        expect(markup).toContain('Found skill-coach');
        // Collapsed by default
        expect(markup).toContain('aria-expanded="false"');
    });

    test('completed expanded state: aria-expanded=true when isExpanded prop is true', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={completedPart()} isExpanded={true} />
            </I18nProvider>,
        );

        expect(markup).toContain('Skill Search');
        // aria-expanded reflects the controlled prop
        expect(markup).toContain('aria-expanded="true"');
        // Summary hidden when expanded (filled by placeholder)
        expect(markup).toContain('<span class=\"min-w-0 flex-1\"></span>');
    });

    test('error state: renders tool name and error summary', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={errorPart()} />
            </I18nProvider>,
        );

        expect(markup).toContain('Skill Search');
        expect(markup).toContain('Failed to search skills: timeout');
    });

    test('summary truncates output longer than 80 chars with ellipsis', () => {
        const longOutput = 'A'.repeat(100);
        const part = completedPart({
            state: {
                status: 'completed',
                input: { query: 'test' },
                output: longOutput,
                title: 'Test',
                time: { start: 1000000, end: 1000500 },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // The summary is 80 A's + ellipsis
        // Should contain the first 80 chars
        const expectedSnippet = 'A'.repeat(80);
        expect(markup).toContain(expectedSnippet);
        // Should have the ellipsis character
        expect(markup).toContain('…');
    });

    test('output that is valid JSON is formatted as pretty-printed JSON in the output section (running state shows input)', () => {
        // Running state auto-renders expanded content in SSR (shouldRenderExpandedContent = true)
        const part = runningPart({
            state: {
                status: 'running',
                input: { query: 'find-skill', options: { limit: 5 } },
                time: { start: Date.now() },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // Input should be rendered as formatted JSON (HTML-escaped in SSR)
        expect(markup).toContain('&quot;query&quot;');
        expect(markup).toContain('&quot;find-skill&quot;');
        expect(markup).toContain('&quot;options&quot;');
        expect(markup).toContain('&quot;limit&quot;');
    });

    test('duration is displayed for completed state', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={completedPart()} />
            </I18nProvider>,
        );

        // Duration from (1000500 - 1000000) / 1000 = 0.5s
        expect(markup).toContain('0.5s');
    });

    test('duration is displayed for error state', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={errorPart()} />
            </I18nProvider>,
        );

        // Duration from (1003000 - 1000000) / 1000 = 3.0s
        expect(markup).toContain('3.0s');
    });

    test('renders data-testid="tool-part" for running state', () => {
        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={runningPart()} />
            </I18nProvider>,
        );

        expect(markup).toContain('data-testid="tool-part"');
    });

    test('renders meta_use with display name from input.name — Meta Use "bash"', () => {
        const part = completedPart({
            tool: 'meta_use',
            state: {
                status: 'completed',
                input: { name: 'bash', args: { command: 'ls' } },
                output: 'Executed bash',
                title: 'Meta Use',
                time: { start: 1000000, end: 1000500 },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // Spec: display is `Meta Use "bash"` — the "Meta Use" prefix is the whole point
        // renderToStaticMarkup HTML-escapes quotes, so we get &quot; in the markup
        expect(markup).toContain('Meta Use &quot;bash&quot;');
        expect(markup).not.toContain(`Tool ${'Use'} &quot;bash&quot;`);
        // Must NOT resolve inner tool metadata (no "Shell Command")
        expect(markup).not.toContain('Shell Command');
    });

    test('renders meta_use with display name from input.name — Meta Use \"octocode_localGetFileContent\"', () => {
        const part = completedPart({
            tool: 'meta_use',
            state: {
                status: 'completed',
                input: { name: 'octocode_localGetFileContent', args: { path: '/foo' } },
                output: 'File content',
                title: 'Meta Use',
                time: { start: 1000000, end: 1000500 },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // Spec: display is `Meta Use "octocode_localGetFileContent"` — the "Meta Use" prefix is the whole point
        // renderToStaticMarkup HTML-escapes quotes, so we get &quot; in the markup
        expect(markup).toContain('Meta Use &quot;octocode_localGetFileContent&quot;');
        expect(markup).not.toContain(`Tool ${'Use'} &quot;octocode_localGetFileContent&quot;`);
        // Must NOT resolve inner tool metadata (no "Octocode localGetFileContent")
        expect(markup).not.toContain('Octocode localGetFileContent');
    });

    test('renders meta_use fallback to "Meta Use" when input has no name or tool', () => {
        const part = completedPart({
            tool: 'meta_use',
            state: {
                status: 'completed',
                input: {},
                output: 'No inner tool',
                title: 'Meta Use',
                time: { start: 1000000, end: 1000500 },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // Falls back to the 'meta_use' metadata display name
        expect(markup).toContain('Meta Use');
        expect(markup).not.toContain(`Tool ${'Use'}`);
    });

    test('meta_search: shows query in collapsed state instead of output', () => {
        const part = completedPart({
            tool: 'meta_search',
            state: {
                status: 'completed',
                input: { query: 'billing calculation' },
                output: 'Found 3 matching skills with relevance scores and descriptions',
                title: 'Meta Search',
                time: { start: 1000000, end: 1000500 },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // Shows the query in collapsed state
        expect(markup).toContain('Search &quot;billing calculation&quot;');
        // Must NOT show the output summary
        expect(markup).not.toContain('Found 3 matching');
    });

    test('renders arrow-right icon for meta_use — does NOT resolve inner tool icon', () => {
        const part = completedPart({
            tool: 'meta_use',
            state: {
                status: 'completed',
                input: { name: 'bash', args: { command: 'ls' } },
                output: 'Executed bash',
                title: 'Meta Use',
                time: { start: 1000000, end: 1000500 },
            },
        });

        const markup = renderToStaticMarkup(
            <I18nProvider>
                <MetaToolPart part={part} />
            </I18nProvider>,
        );

        // Spec: icon always uses toolName ('meta_use' → arrow-right), does NOT resolve inner tool icon
        expect(markup).toContain('oc-arrow-right"');
        // Must NOT resolve inner tool icon (no terminal-box)
        expect(markup).not.toContain('terminal-box');
    });
});
