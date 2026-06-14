---
type: adr
id: ADR-0008
title: "Tool Use Log Format: Quoted Inner Name with Unchanged Icon"
status: accepted
createdAt: "2026-06-14T17:45:00Z"
updatedAt: "2026-06-14T17:45:00Z"
tags: [ui, tool-use, meta-tool, rendering]
supersedes: []
superseded_by: []
see_also: []
---

# ADR-0008: Tool Use Log Format — Quoted Inner Name with Unchanged Icon

## Context

When `tool_use` meta-tool entries appear in the agent-meta-tool chat view, the collapsed header displays only the generic label "Tool Use" with no indication of which inner MCP tool was invoked. Every `tool_use` entry is visually indistinguishable in collapsed state:

```
[arrow-right] Tool Use  Executed bash command...
[arrow-right] Tool Use  Read 42 lines...
[arrow-right] Tool Use  Found 3 results...
```

The inner tool name is available in `state.input.name` (MCP convention), but was not being used for display.

## Decision

Format `tool_use` collapsed headers as `Tool Use "<inner tool name>"` — e.g., `Tool Use "bash"`, `Tool Use "octocode_localGetFileContent"` — while keeping the `arrow-right` icon unchanged.

Specifically:

1. **Display name:** `Tool Use "<innerName>"` — extract from `state.input.name` (MCP convention only; no `state.input.tool` fallback since built-in tools bypass MetaTool entirely)
2. **Icon:** Always `arrow-right` — do NOT resolve the inner tool icon (e.g., `bash` → `terminal-box`)
3. **Fallback:** When `state.input.name` is missing (e.g., during streaming), fall back to `getToolMetadata('tool_use').displayName` = "Tool Use"

Implementation lives inline in the `useMemo` for `displayName` in `MetaToolPart.tsx` (lines 117–127).

```tsx
const displayName = React.useMemo(() => {
    if (toolName === 'tool_use') {
        const inp = state?.input as Record<string, unknown> | undefined;
        const innerName = inp?.name as string | undefined;
        if (innerName) return `Tool Use "${innerName}"`;
    }
    return getToolMetadata(toolName).displayName;
}, [toolName, state]);

const icon = React.useMemo(() => getToolIcon(toolName), [toolName]);
```

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| Just the inner tool display name (e.g., "Bash") | Concise, no meta-tool prefix | Loses the "this is a meta-tool wrapper" context; user cannot distinguish direct calls from wrapped calls | No meta-tool context |
| Resolve inner tool icon too | More visual variety; semantically meaningful icons | Adds a second code path (`getToolIcon(innerName)`); inconsistent with user direction to keep icon unchanged | User-directed constraint; adds complexity |
| Support `state.input.tool` fallback | Defensive coding | `input.tool` is the opencode native convention; built-in tools bypass MetaTool — this path would never be hit in practice | Dead code path |
| Extract to helper function | Isolated testability | The operation is a single conditional with a string template literal — over-engineers for a trivial operation | Unnecessary indirection |
| `Tool Use: inner name` (colon instead of quotes) | Simple separator | Colon is less visually distinctive than quoted name | Quotes provide better visual grouping |

## Consequences

- **Positive:** Collapsed headers are immediately scannable — users can identify which MCP tool was invoked without expanding
- **Positive:** The "Tool Use" prefix preserves meta-tool context — distinguishes from direct tool calls
- **Positive:** Single change point (`displayName` variable) fixes all four collapsed states (completed, error, running, pending)
- **Positive:** Zero functional impact — pure display change; expanded state (rich JSON) is unchanged
- **Negative:** Inner tool icons (e.g., `terminal-box` for bash) are not shown — some visual information is foregone
- **Neutral:** During streaming, incomplete state falls back to generic "Tool Use" — acceptable for transient display
