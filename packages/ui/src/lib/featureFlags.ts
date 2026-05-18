import { useFeatureFlagsStore } from '@/stores/useFeatureFlagsStore';

/**
 * Get feature flag value, checking Settings UI first (if in React context),
 * then falling back to environment variable for non-React contexts or when setting not configured.
 * 
 * @param key - The feature flag key (e.g., 'subagents.editable')
 * @param defaultValue - Default value if both settings and env var are unset
 * @returns The feature flag boolean value
 */
export function getFeatureFlag<T extends boolean>(key: string, defaultValue: T): T {
  // Try to get from Settings UI store (React context)
  try {
    const settings = (window as unknown as Window & { opencodeSettings?: Record<string, unknown> }).opencodeSettings;
    if (settings && key in settings) {
      return (settings[key as keyof typeof settings] as boolean) ?? defaultValue;
    }
  } catch {
    // If window.opencodeSettings doesn't exist yet, continue to env var fallback
  }

  // Fallback to default from FeatureFlagsStore
  if (key === 'planMode.enabled') {
    const result = useFeatureFlagsStore.getState().planModeEnabled;
    return result as T;
  }

  if (key === 'subagents.editable') {
    const result = useFeatureFlagsStore.getState().editableSubagents;
    return result as T;
  }

  return defaultValue;
}

/**
 * React hook version of getFeatureFlag that properly integrates with React reactivity
 */
export function useFeatureFlag<T extends boolean>(key: string, defaultValue: T): T {
  const store = useFeatureFlagsStore();
  
  if (key === 'planMode.enabled') {
    return store.planModeEnabled as T;
  }
  
 if (key === 'subagents.editable') {
    return store.editableSubagents as T;
  }
  
  return defaultValue;
}
