---
type: memory
title: "Per-device composer UI preferences persist via useUIStore partialize, not updateDesktopSettings"
createdAt: "2026-11-13T19:28:06Z"
updatedAt: "2026-11-13T19:28:06Z"
tags: [settings, persistence, zustand, ui-store, desktop-settings, composer]
see_also:
  - "adrs/0015-arrow-key-prompt-history-toggle-default-off.adr.md"
  - "concepts/0002-feature-flags-system.concept.md"
deprecated:
  date: null
  reason: null
  superseded_by: null
---

# Memory: Two persistence mechanisms for composer UI settings

## Fact

Setting classes in the Settings UI split across two live mechanisms; the
composer's own ergonomics preferences belong to the zustand `useUIStore`
persist slice (`partialize`, per browser/app profile), NOT to
`updateDesktopSettings` (server-side, cross-runtime, save-status flow).
`persistChatDraft` and `arrowKeyPromptHistoryEnabled` are the paired precedent
(ADR-0015).

## Context

Class rule applied when ADR-0015 landed (working session decisions record,
Decision 3): the persistence mechanism must match the setting's ownership class.
A per-device keyboard-ergonomics preference of the composer is the exact class
of the shipped draft-persistence setting, which uses the partialize path end to
end (store field → consumer selector → SettingsCheckboxRow → search registry →
i18n pair). Routing such a setting through desktop settings would widen a
server-persisted contract (cross-runtime parity work, settings-file
compatibility) with no requirement behind it.

## Impact

New composer/local UI settings follow the partialize class by default; the known
consequence is per-browser-profile durability with no cross-device sync — state
it when a requirement for cross-device persistence appears, then that setting's
class genuinely differs.
