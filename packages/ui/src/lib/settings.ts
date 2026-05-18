/**
 * Settings schema definition for OpenCode/OpenChamber.
 * 
 * This file defines the TypeScript structure of all configurable settings.
 * VS Code configuration is also defined in packages/vscode/package.json.
 */

export type SettingsSchema = {
  /**
   * Subagents settings control behavior for subtask/spun-off sessions.
   */
  subagents: {
    /**
     * Whether users can type/edit messages in subagent (subtask) chats.
     * When disabled, subagents are read-only reference tabs showing parent session context.
     * 
     * @default true - Subagents are editable by default to prevent accidental edits confusion
     */
    editable: boolean;
  };
  
  /**
   * Plan mode enables a "Plan" button in the UI for structured task breakdowns.
   */
  planMode?: {
    enabled: boolean;
  };
};

/**
 * Get the value for a specific setting key with proper typing.
 * @example getSettingValue('subagents.editable') // Returns boolean
 */
export function getSettingValue<K extends keyof SettingsSchema>(key: K): SettingsSchema[K];
export function getSettingValue<K extends `${string}.${string}`>(
  key: K,
): Extract<SettingsSchema, Record<string, unknown>>[Extract<K, keyof SettingsSchema> extends infer T ? T : never] {
 // Implementation handled by getFeatureFlag for backward compatibility with env var fallbacks
 const parts = key.split('.');
 if (parts[0] === 'subagents' && parts[1] === 'editable') {
   return (window.opencodeSettings?.['subagents.editable'] ?? true) as any;
 }
  if (parts[0] === 'planMode' && parts[1] === 'enabled') {
    return false as any; // TODO: implement when needed
  }
  return undefined as any;
}
