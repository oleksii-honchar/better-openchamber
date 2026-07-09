---
type: adr
id: ADR-0009
title: "Rename Meta Tools: tool_search → meta_search, tool_use → meta_use"
status: accepted
createdAt: "2026-07-09T19:00:00Z"
updatedAt: "2026-07-09T19:00:00Z"
tags: [meta-tools, naming, ui]
supersedes: []
superseded_by: []
see_also:
  - "adrs/0008-tool-use-log-format.adr.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# ADR-0009: Rename Meta Tools: tool_search → meta_search, tool_use → meta_use

## Context

The meta tool names `tool_search` and `tool_use` were renamed to `meta_search` and `meta_use` across the agent-meta-tool plugin and its consumers. In better-openchamber, this affects the UI layer that renders tool names in VS Code chat logs — `META_TOOL_NAMES` set, `TOOL_METADATA` keys, string checks in `MetaToolPart.tsx` and `toolPresentation.tsx`.

## Decision

Update all meta tool references in better-openchamber UI code:
- `META_TOOL_NAMES` set in `toolRenderUtils.ts` — `['skill_search', 'meta_search', 'meta_use']`
- `TOOL_METADATA` keys in `toolHelpers.ts` — `meta_search`, `meta_use` entries
- String checks in `MetaToolPart.tsx` — `'meta_use'`, `'meta_search'`
- Icon lookups in `toolPresentation.tsx` — use `meta_` names

This ensures VS Code chat logs display the new, unambiguous names.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|-------------|------|------|-------------|
| Keep old names in UI | Minimal changes | Log ambiguity persists | Rejected |
| **Update to meta_search/meta_use** | Consistent with agent-meta-tool | Requires UI updates | **Selected** |

## Consequences

- **Positive:** UI logs now show unambiguous `meta_search` / `meta_use` names
- **Positive:** Consistent with the agent-meta-tool source rename
- **Neutral:** 2 comment references to old names remain (non-blocking, documented in agent-meta-tool vault)
