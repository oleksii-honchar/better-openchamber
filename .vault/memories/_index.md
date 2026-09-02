---
type: index
title: "Atomic Memories"
createdAt: "2026-06-12T14:30:00Z"
updatedAt: "2026-09-02T15:49:08Z"
tags: []
---

# Atomic Memories

Atomic durable facts about the better-openchamber fork — incident learnings, API quirks, SDK limitations, deployment gotchas, and one-off knowledge that doesn't belong in ADRs, concepts, or runbooks.

## Nodes

- [[0001-npm-sdk-body-prefix-workaround.memory]] — `$body_` prefix workaround for npm SDK v1.14.19's silent field dropping in `buildClientParams`
- [[0002-local-sdk-alias.memory]] — Local SDK alias replacing the npm SDK workaround (Vite alias to `better-opencode/packages/sdk`)
- [[0003-chatviewprovider-regression.memory]] — ChatViewProvider.ts regression after squash rebase (4 upstream methods dropped in conflict resolution)
- [[0004-session-actions-sdk-followup.memory]] — session-actions.ts still uses old SDK pattern (follow-up: migrate to `opencodeClient.createSession()`)
- [[0005-composer-paste-path-command-palette.memory]] — Composer command palette no longer opens on pasted filesystem paths (`triggers.ts` paste/path guard)
