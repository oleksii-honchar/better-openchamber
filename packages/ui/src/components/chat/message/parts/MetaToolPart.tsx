import React from 'react';
import { animate, type AnimationPlaybackControls } from 'motion';
import type { ToolPart } from '@opencode-ai/sdk/v2';
import type { ContentChangeReason } from '@/hooks/useChatAutoFollow';
import { cn } from '@/lib/utils';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { Icon } from '@/components/icon/Icon';
import { BusyDots } from './BusyDots';
import { TEST_IDS } from '@/lib/test-ids';
import { getToolIcon } from './toolPresentation';
import { getToolMetadata } from '@/lib/toolHelpers';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOOL_ROW_TEXT_CLASS = '!text-[length:var(--text-meta)] !leading-4 sm:!leading-6 tracking-normal';
const TOOL_ROW_TITLE_CLASS = cn('typography-meta font-medium', TOOL_ROW_TEXT_CLASS);
const TOOL_ROW_DESCRIPTION_CLASS = cn('typography-meta', TOOL_ROW_TEXT_CLASS);
const SUMMARY_MAX_CHARS = 80;
const EXPANDED_CONTENT_UNMOUNT_DELAY_MS = 200;
const EXPANDED_CONTENT_TRANSITION = { duration: 0.2, ease: 'easeOut' as const };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Truncate output to first ~80 chars, cutting at word boundary with ellipsis. */
const getMetaToolSummary = (output: string): string => {
    if (!output) return '';
    const flat = output.replace(/\s+/g, ' ').trim();
    if (flat.length <= SUMMARY_MAX_CHARS) return flat;
    const cut = flat.lastIndexOf(' ', SUMMARY_MAX_CHARS);
    const end = cut > 0 ? cut : SUMMARY_MAX_CHARS;
    return `${flat.substring(0, end).trimEnd()}…`;
};

/**
 * Format tool output for display:
 * - If valid JSON, pretty-print with indentation.
 * - Otherwise return raw text.
 */
const formatOutput = (output: string): string => {
    if (!output) return '';
    try {
        const parsed = JSON.parse(output);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return output;
    }
};

/**
 * Format tool input for display as pretty-printed JSON.
 */
const formatInput = (input: Record<string, unknown>): string => {
    if (!input || Object.keys(input).length === 0) return '';
    return JSON.stringify(input, null, 2);
};

/** Format duration in seconds from start/end timestamps (milliseconds). */
const formatDuration = (start: number, end: number): string =>
    `${((end - start) / 1000).toFixed(1)}s`;

// ── Types ─────────────────────────────────────────────────────────────────────

type ExpansionState = {
    expanded: boolean;
    source: 'auto' | 'user';
};

interface MetaToolPartProps {
    part: ToolPart;
    isExpanded?: boolean;
    onToggle?: (id: string) => void;
    syntaxTheme?: Record<string, React.CSSProperties>;
    isStreaming?: boolean;
    onContentChange?: (reason: ContentChangeReason) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MetaToolPart: React.FC<MetaToolPartProps> = ({
    part,
    isExpanded: isExpandedProp,
    onToggle,
    syntaxTheme,
    isStreaming: isStreamingProp,
    onContentChange,
}) => {
    const toolName = part.tool;
    const state = part.state;
    const status = state.status;
    const hasEnded = status === 'completed' || status === 'error';

    // Determine if this is a stream situation — running without completion is live
    const canAutoExpand = (isStreamingProp === true || status === 'running') && !hasEnded;

    // Expansion management (controlled or uncontrolled)
    const [internalExpansion, setInternalExpansion] = React.useState<ExpansionState>({
        expanded: canAutoExpand,
        source: 'auto',
    });

    const isExpanded = isExpandedProp !== undefined
        ? isExpandedProp
        : internalExpansion.source === 'auto'
            ? canAutoExpand && internalExpansion.expanded
            : internalExpansion.expanded;

    const [shouldRenderExpandedContent, setShouldRenderExpandedContent] = React.useState(
        status === 'running' || canAutoExpand,
    );

    const contentId = React.useId();
    const scrollRef = React.useRef<HTMLElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const contentAnimationRef = React.useRef<AnimationPlaybackControls | null>(null);
    const contentMountedRef = React.useRef(false);

    // Metadata
    const displayName = React.useMemo(() => {
        if (toolName === 'meta_use') {
            const inp = state?.input as Record<string, unknown> | undefined;
            const innerName = inp?.name as string | undefined;
            if (innerName) return `Tool Use "${innerName}"`;
        }
        return getToolMetadata(toolName).displayName;
    }, [toolName, state]);

    const icon = React.useMemo(() => getToolIcon(toolName), [toolName]);

    // Summary
    const summary = React.useMemo(() => {
        if (status === 'error') return (state as { error: string }).error || '';
        if (status === 'completed') {
            // meta_search: show the query in collapsed state
            if (toolName === 'meta_search') {
                const inp = (state as { input: Record<string, unknown> }).input;
                const query = inp?.query as string | undefined;
                if (query) return `Search "${query}"`;
            }
            return getMetaToolSummary((state as { output: string }).output || '');
        }
        return '';
    }, [status, state, toolName]);

    // Duration
    const duration = React.useMemo(() => {
        if ((status === 'completed' || status === 'error') && 'time' in state) {
            const t = state.time as { start: number; end: number };
            if (t && typeof t.start === 'number' && typeof t.end === 'number') {
                return formatDuration(t.start, t.end);
            }
        }
        return null;
    }, [status, state]);

    // Toggle handler
    const handleToggle = React.useCallback(() => {
        if (onToggle) {
            onToggle(part.id);
        } else {
            setInternalExpansion((prev) => ({ expanded: !prev.expanded, source: 'user' }));
        }
        onContentChange?.('structural');
    }, [part.id, onToggle, onContentChange]);

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleToggle();
            }
        },
        [handleToggle],
    );

    // Auto-expand when running
    React.useLayoutEffect(() => {
        setInternalExpansion((prev) => {
            if (prev.source === 'user') return prev;
            if (prev.expanded === canAutoExpand) return prev;
            return { expanded: canAutoExpand, source: 'auto' };
        });
    }, [canAutoExpand]);

    // Notify parent of content changes
    React.useEffect(() => {
        onContentChange?.('structural');
    }, [onContentChange, status, summary]);

    // Auto-scroll when live streaming
    React.useEffect(() => {
        if (status === 'running' && isExpanded && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [status, isExpanded, state]);

    // Delayed unmount for collapse animation
    React.useEffect(() => {
        if (isExpanded || canAutoExpand) {
            setShouldRenderExpandedContent(true);
            return;
        }

        if (!shouldRenderExpandedContent) return;

        if (typeof window === 'undefined') {
            setShouldRenderExpandedContent(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setShouldRenderExpandedContent(false);
        }, EXPANDED_CONTENT_UNMOUNT_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [isExpanded, canAutoExpand, shouldRenderExpandedContent]);

    // Expand/collapse animation
    React.useLayoutEffect(() => {
        const element = contentRef.current;
        if (!element) return;

        contentAnimationRef.current?.stop();

        if (!contentMountedRef.current) {
            contentMountedRef.current = true;
            if (!isExpanded) {
                element.style.height = '0px';
                element.style.overflow = 'hidden';
                return;
            }

            element.style.height = '0px';
            element.style.overflow = 'hidden';

            const animation = animate(element, { height: 'auto' }, EXPANDED_CONTENT_TRANSITION);
            contentAnimationRef.current = animation;

            void animation.finished
                .then(() => {
                    if (contentAnimationRef.current !== animation) return;
                    contentAnimationRef.current = null;
                    element.style.overflow = 'visible';
                    element.style.height = 'auto';
                })
                .catch(() => undefined);

            return () => {
                animation.stop();
                if (contentAnimationRef.current === animation) {
                    contentAnimationRef.current = null;
                }
            };
        }

        element.style.overflow = 'hidden';

        if (isExpanded) {
            element.style.height = '0px';
        } else {
            element.style.height = `${element.scrollHeight}px`;
        }

        const animation = animate(element, { height: isExpanded ? 'auto' : '0px' }, EXPANDED_CONTENT_TRANSITION);
        contentAnimationRef.current = animation;

        void animation.finished
            .then(() => {
                if (contentAnimationRef.current !== animation) return;
                contentAnimationRef.current = null;
                if (isExpanded) {
                    element.style.overflow = 'visible';
                    element.style.height = 'auto';
                } else {
                    element.style.overflow = 'hidden';
                }
            })
            .catch(() => undefined);

        return () => {
            animation.stop();
            if (contentAnimationRef.current === animation) {
                contentAnimationRef.current = null;
            }
        };
    }, [isExpanded]);

    React.useEffect(() => {
        return () => {
            contentAnimationRef.current?.stop();
            contentAnimationRef.current = null;
        };
    }, []);

    // ── Pending state: simple row, no expandable content ───────────────────
    if (status === 'pending') {
        return (
            <div data-meta-tool-block-id={part.id}>
                <div className="flex items-center gap-1.5 pr-2 pl-px py-1.5 rounded-xl">
                    <span className="flex-shrink-0" style={{ color: 'var(--tools-icon)' }}>
                        {icon}
                    </span>
                    <span className={TOOL_ROW_TITLE_CLASS} style={{ color: 'var(--tools-title)' }}>
                        {displayName}
                    </span>
                    <span
                        className={TOOL_ROW_DESCRIPTION_CLASS}
                        style={{ color: 'var(--tools-description)', opacity: 0.6 }}
                    >
                        ...
                    </span>
                </div>
            </div>
        );
    }

    // ── Running state: expandable input ────────────────────────────────────
    if (status === 'running') {
        const runningInput = (state as { input?: Record<string, unknown> }).input;

        return (
            <div data-meta-tool-block-id={part.id}>
                <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    className="group/tool flex gap-1.5 pr-2 pl-px py-1.5 rounded-xl cursor-pointer items-center"
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                >
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="relative h-3.5 w-3.5 flex-shrink-0 cursor-pointer">
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity',
                                    isExpanded && 'opacity-0',
                                    !isExpanded && 'group-hover/tool:opacity-0',
                                )}
                                style={{ color: 'var(--tools-icon)' }}
                            >
                                {icon}
                            </div>
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity flex items-center justify-center',
                                    isExpanded && 'opacity-100',
                                    !isExpanded && 'opacity-0 group-hover/tool:opacity-100',
                                )}
                                style={{ color: 'var(--tools-icon)' }}
                            >
                                {isExpanded ? (
                                    <Icon name="arrow-down-s" className="h-3.5 w-3.5" />
                                ) : (
                                    <Icon name="arrow-right-s" className="h-3.5 w-3.5" />
                                )}
                            </div>
                        </div>

                        <span className={cn('flex items-center gap-1', TOOL_ROW_TITLE_CLASS)} style={{ color: 'var(--tools-title)' }}>
                            <span>{displayName}</span>
                            <BusyDots />
                        </span>
                    </div>

                    <div className="flex-1 min-w-0" />
                </div>

                {shouldRenderExpandedContent ? (
                    <div
                        ref={contentRef}
                        id={contentId}
                        aria-hidden={!isExpanded}
                        style={{
                            height: isExpanded ? 'auto' : '0px',
                            overflow: isExpanded ? 'visible' : 'hidden',
                            overflowAnchor: 'none',
                        }}
                    >
                        <div
                            className="relative ml-2 pl-3 pb-1 pt-0.5"
                            style={{
                                opacity: isExpanded ? 1 : 0,
                                transform: isExpanded ? 'translateY(0)' : 'translateY(-4px)',
                                transition: 'opacity 180ms ease-out, transform 180ms ease-out',
                            }}
                        >
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
                                style={{ backgroundColor: 'var(--tools-border)' }}
                            />
                            <ScrollableOverlay
                                ref={scrollRef}
                                as="div"
                                outerClassName="max-h-80"
                                className="p-0"
                                useScrollShadow
                                scrollShadowSize={36}
                                userIntentOnly
                                data-testid={TEST_IDS.CHAT.TOOL_PART}
                            >
                                {runningInput && Object.keys(runningInput).length > 0 ? (
                                    <div className="px-3 py-2">
                                        <div className="typography-meta font-medium mb-1 opacity-60">Input</div>
                                        <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                            <code>{formatInput(runningInput)}</code>
                                        </pre>
                                    </div>
                                ) : null}
                            </ScrollableOverlay>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    // ── Completed state ─────────────────────────────────────────────────────
    if (status === 'completed') {
        const completedState = state as {
            input: Record<string, unknown>;
            output: string;
            time: { start: number; end: number };
        };
        const formattedOutput = formatOutput(completedState.output);
        const formattedInput = formatInput(completedState.input);

        return (
            <div data-meta-tool-block-id={part.id}>
                <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    className="group/tool flex gap-1.5 pr-2 pl-px py-1.5 rounded-xl cursor-pointer items-center"
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                >
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="relative h-3.5 w-3.5 flex-shrink-0 cursor-pointer">
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity',
                                    isExpanded && 'opacity-0',
                                    !isExpanded && 'group-hover/tool:opacity-0',
                                )}
                                style={{ color: 'var(--tools-icon)' }}
                            >
                                {icon}
                            </div>
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity flex items-center justify-center',
                                    isExpanded && 'opacity-100',
                                    !isExpanded && 'opacity-0 group-hover/tool:opacity-100',
                                )}
                                style={{ color: 'var(--tools-icon)' }}
                            >
                                {isExpanded ? (
                                    <Icon name="arrow-down-s" className="h-3.5 w-3.5" />
                                ) : (
                                    <Icon name="arrow-right-s" className="h-3.5 w-3.5" />
                                )}
                            </div>
                        </div>

                        <span className={TOOL_ROW_TITLE_CLASS} style={{ color: 'var(--tools-title)' }}>
                            {displayName}
                        </span>
                    </div>

                    <div className={cn('flex items-center gap-1 flex-1 min-w-0', TOOL_ROW_DESCRIPTION_CLASS)} style={{ color: 'var(--tools-description)' }}>
                        {!isExpanded && summary ? (
                            <span
                                className={cn('min-w-0 truncate', TOOL_ROW_DESCRIPTION_CLASS)}
                                style={{ color: 'var(--tools-description)', opacity: 0.8 }}
                                title={summary}
                            >
                                {summary}
                            </span>
                        ) : (
                            <span className="min-w-0 flex-1" />
                        )}
                    </div>

                    {duration ? (
                        <span
                            className="flex-shrink-0 text-xs tabular-nums opacity-50"
                            style={{ color: 'var(--tools-description)' }}
                        >
                            {duration}
                        </span>
                    ) : null}
                </div>

                {shouldRenderExpandedContent ? (
                    <div
                        ref={contentRef}
                        id={contentId}
                        aria-hidden={!isExpanded}
                        style={{
                            height: isExpanded ? 'auto' : '0px',
                            overflow: isExpanded ? 'visible' : 'hidden',
                            overflowAnchor: 'none',
                        }}
                    >
                        <div
                            className="relative ml-2 pl-3 pb-1 pt-0.5"
                            style={{
                                opacity: isExpanded ? 1 : 0,
                                transform: isExpanded ? 'translateY(0)' : 'translateY(-4px)',
                                transition: 'opacity 180ms ease-out, transform 180ms ease-out',
                            }}
                        >
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
                                style={{ backgroundColor: 'var(--tools-border)' }}
                            />
                            <ScrollableOverlay
                                ref={scrollRef}
                                as="div"
                                outerClassName="max-h-80"
                                className="p-0"
                                useScrollShadow
                                scrollShadowSize={36}
                                userIntentOnly
                                data-testid={TEST_IDS.CHAT.TOOL_PART}
                            >
                                {formattedInput ? (
                                    <div className="px-3 py-2">
                                        <div className="typography-meta font-medium mb-1 opacity-60">Input</div>
                                        <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                            <code>{formattedInput}</code>
                                        </pre>
                                    </div>
                                ) : null}

                                {formattedOutput ? (
                                    <div className="px-3 py-2 border-t border-tools-border/40">
                                        <div className="typography-meta font-medium mb-1 opacity-60">Output</div>
                                        <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                            <code>{formattedOutput}</code>
                                        </pre>
                                    </div>
                                ) : null}
                            </ScrollableOverlay>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────
    if (status === 'error') {
        const errorState = state as {
            input: Record<string, unknown>;
            error: string;
            time: { start: number; end: number };
        };
        const formattedInput = formatInput(errorState.input);

        return (
            <div data-meta-tool-block-id={part.id}>
                <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    className="group/tool flex gap-1.5 pr-2 pl-px py-1.5 rounded-xl cursor-pointer items-center"
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                >
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="relative h-3.5 w-3.5 flex-shrink-0 cursor-pointer">
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity',
                                    isExpanded && 'opacity-0',
                                    !isExpanded && 'group-hover/tool:opacity-0',
                                )}
                                style={{ color: 'var(--status-error)' }}
                            >
                                {icon}
                            </div>
                            <div
                                className={cn(
                                    'absolute inset-0 transition-opacity flex items-center justify-center',
                                    isExpanded && 'opacity-100',
                                    !isExpanded && 'opacity-0 group-hover/tool:opacity-100',
                                )}
                                style={{ color: 'var(--status-error)' }}
                            >
                                {isExpanded ? (
                                    <Icon name="arrow-down-s" className="h-3.5 w-3.5" />
                                ) : (
                                    <Icon name="arrow-right-s" className="h-3.5 w-3.5" />
                                )}
                            </div>
                        </div>

                        <span className={TOOL_ROW_TITLE_CLASS} style={{ color: 'var(--status-error)' }}>
                            {displayName}
                        </span>
                    </div>

                    <div className={cn('flex items-center gap-1 flex-1 min-w-0', TOOL_ROW_DESCRIPTION_CLASS)} style={{ color: 'var(--status-error)' }}>
                        {!isExpanded && summary ? (
                            <span
                                className={cn('min-w-0 truncate', TOOL_ROW_DESCRIPTION_CLASS)}
                                style={{ color: 'var(--status-error)', opacity: 0.8 }}
                                title={summary}
                            >
                                {summary}
                            </span>
                        ) : (
                            <span className="min-w-0 flex-1" />
                        )}
                    </div>

                    {duration ? (
                        <span className="flex-shrink-0 text-xs tabular-nums opacity-50" style={{ color: 'var(--status-error)' }}>
                            {duration}
                        </span>
                    ) : null}
                </div>

                {shouldRenderExpandedContent ? (
                    <div
                        ref={contentRef}
                        id={contentId}
                        aria-hidden={!isExpanded}
                        style={{
                            height: isExpanded ? 'auto' : '0px',
                            overflow: isExpanded ? 'visible' : 'hidden',
                            overflowAnchor: 'none',
                        }}
                    >
                        <div
                            className="relative ml-2 pl-3 pb-1 pt-0.5"
                            style={{
                                opacity: isExpanded ? 1 : 0,
                                transform: isExpanded ? 'translateY(0)' : 'translateY(-4px)',
                                transition: 'opacity 180ms ease-out, transform 180ms ease-out',
                            }}
                        >
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
                                style={{ backgroundColor: 'var(--tools-border)' }}
                            />
                            <ScrollableOverlay
                                ref={scrollRef}
                                as="div"
                                outerClassName="max-h-80"
                                className="p-0"
                                useScrollShadow
                                scrollShadowSize={36}
                                userIntentOnly
                                data-testid={TEST_IDS.CHAT.TOOL_PART}
                            >
                                {formattedInput ? (
                                    <div className="px-3 py-2">
                                        <div className="typography-meta font-medium mb-1 opacity-60">Input</div>
                                        <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                            <code>{formattedInput}</code>
                                        </pre>
                                    </div>
                                ) : null}

                                {errorState.error ? (
                                    <div className="px-3 py-2 border-t border-tools-border/40">
                                        <div className="typography-meta font-medium mb-1 opacity-60">Error</div>
                                        <pre className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-status-error">
                                            <code>{errorState.error}</code>
                                        </pre>
                                    </div>
                                ) : null}
                            </ScrollableOverlay>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    // Unknown status — render nothing
    return null;
};

MetaToolPart.displayName = 'MetaToolPart';
