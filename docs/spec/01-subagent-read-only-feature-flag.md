# 08-subagent-read-only-feature-flag.md

## Context

OpenChamber v1.11.1 (May 15–18, 2026) introduced read-only behavior for subagent sessions via two commits:

- **`526f9a51`** (`feat: open subagent sessions read-only in context panel`) — Hardcodes `readOnly: true` when opening subtask sessions from MessageBody.tsx
- **`e2f45bda`** (`feat: make subagent chats read-only`) — Enforces `promptReadOnly = readOnly || Boolean(parentSession)` in ChatContainer.tsx

Previously, users expected to be able to edit subagent (subtask) chats independently after forking them from a parent session. The change was intentional to treat subagents as "reference" sessions viewable in the Context Panel or via "Open session" link, but not editable as standalone sibling chats.

## Problem

Users want an escape hatch to re-enable editable subagents without reverting all of v1.11.1's behavior or waiting for upstream changes. A pure-code-change toggle is needed immediately in the fork (`better-openchamber`).

## Solution: `subagents.editable` Feature Flag

Add a runtime feature flag `subagents.editable` (default `false`) that conditionally skips read-only enforcement for sessions with parents.

### Implementation

#### File 1: `packages/ui/src/components/chat/ChatContainer.tsx`

**Current logic (~line 540):**
```tsx
const promptReadOnly = readOnly || Boolean(parentSession);
```

**Change to:**
```tsx
import { useFeatureFlag } from '@/lib/features'; // or whatever the current pattern is

// ...
const features = useFeatures(); // assuming this hook exists
const allowEditableSubagents = features?.get('subagents.editable') === 'true';
const promptReadOnly = readOnly || (!allowEditableSubagents && Boolean(parentSession));
```

**Alternative (if using env directly for MVP):**
```tsx
const allowEditableSubagents = process.env.OPENCODE_SUBAGENTS_EDITABLE === 'true';
const promptReadOnly = readOnly || (!allowEditableSubagents && Boolean(parentSession));
```

#### File 2: `packages/ui/src/components/chat/message/MessageBody.tsx` (Optional)

**Current logic (~line 160):**
When clicking "Open session" on a subtask, it calls:
```tsx
openContextPanelTab(effectiveDirectory, {
    mode: 'chat',
    dedupeKey: `session:${taskSessionID}`,
    label: description || agent || t('contextPanel.mode.chat'),
    readOnly: true,  // ← Always read-only when opened from MessageBody
});
```

**Change to:**
If you want the Context Panel embedded view also editable when the flag is on:
```tsx
const allowEditableSubagents = process.env.OPENCODE_SUBAGENTS_EDITABLE === 'true';
// ...
openContextPanelTab(effectiveDirectory, {
    mode: 'chat',
    dedupeKey: `session:${taskSessionID}`,
    label: description || agent || t('contextPanel.mode.chat'),
    readOnly: !allowEditableSubagents,  // ← Toggleable
});
```

### Configuration Options

**Option A: Settings UI Toggle (Preferred long-term)**
- Add to visual settings: `Features` > `Editable Subagents` checkbox
- Persisted in user/workspace settings JSON
- Respects `userSettings.overrides.subagents.editable`

**Option B: Environment Variable Only (MVP)**
Just add env var `OPENCODE_SUBAGENTS_EDITABLE=true` to `.env` or launch config for immediate testing without UI work.

### Testing Matrix

| Scenario | Flag/Env | Expected Behavior |
|----------|----------|------------------|
| Default | unset/false | Subagents read-only (current v1.11.1 behavior) |
| Editable enabled | `OPENCODE_SUBAGENTS_EDITABLE=true` or Settings checkbox = true | Can type in subagent sessions; "Open session" opens writable Context Panel tab |
| Parent without flag | unset/false | Read-only as before; input shows read-only banner |

### Files Modified

1. `packages/ui/src/components/chat/ChatContainer.tsx` — Add feature flag check to `promptReadOnly` calculation (primary location)
2. `packages/ui/src/components/chat/message/MessageBody.tsx` — Optional: allow editable Context Panel view when clicking "Open session" from a subtask message
3. `packages/ui/src/lib/features/definitions.ts` (if exists) or new settings schema file — Register the toggle

### Verification

After implementation, verify:
- Subagent sessions opened via "Open session" link can receive input (no read-only banner blocking typing)
- Context Panel embedded view allows editing when flag enabled
- Main parent session remains interactive regardless of subagent setting
- Default behavior (flag off) unchanged from v1.11.2

---

**Related**: `findings.md` in current session documents the two commits and escape-hatch analysis.
