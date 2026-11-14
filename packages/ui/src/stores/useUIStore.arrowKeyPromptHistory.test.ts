import { describe, expect, mock, test } from 'bun:test';

// Storage seam follows useConfigStore.test.ts: the mocked safeStorage views all
// share one map, so the store's persisted payload bytes are observable.
const STORAGE_KEY = 'ui-store';
const CURRENT_STORE_VERSION = 15;

let storage = new Map<string, string>();

const makeStorage = (): Storage => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size;
  },
}) as Storage;

mock.module('./utils/safeStorage', () => ({
  getDeferredSafeStorage: () => makeStorage(),
  getSafeStorage: () => makeStorage(),
  getSafeSessionStorage: () => makeStorage(),
  createDeferredSafeJSONStorage: () => {
    const testStorage = makeStorage();
    return {
      getItem: (name: string) => {
        const value = testStorage.getItem(name);
        return value === null ? null : JSON.parse(value);
      },
      setItem: (name: string, value: unknown) => {
        testStorage.setItem(name, JSON.stringify(value));
      },
      removeItem: (name: string) => {
        testStorage.removeItem(name);
      },
    };
  },
}));

const { useUIStore } = await import('./useUIStore');

const flushPendingPersistWrites = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const persistedPayload = (): Record<string, unknown> => {
  const raw = storage.get(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }).state : {};
};

describe('useUIStore arrowKeyPromptHistoryEnabled (default OFF)', () => {
  test('fresh store reports the setting as false when no value was ever stored', async () => {
    // Spec §6 (owner ruling "B", 2026-11-13): missing stored value ⇒ arrow-key
    // prompt-history recall is OFF. No backfill may invent a stored value here.
    await useUIStore.persist.rehydrate();

    expect(useUIStore.getState().arrowKeyPromptHistoryEnabled).toBe(false);
  });

  test('the setter flips the value to true and back to false', () => {
    useUIStore.getState().setArrowKeyPromptHistoryEnabled(true);
    expect(useUIStore.getState().arrowKeyPromptHistoryEnabled).toBe(true);

    useUIStore.getState().setArrowKeyPromptHistoryEnabled(false);
    expect(useUIStore.getState().arrowKeyPromptHistoryEnabled).toBe(false);
  });

  test('the setter leaves adjacent settings untouched', () => {
    const before = {
      persistChatDraft: useUIStore.getState().persistChatDraft,
      inputSpellcheckEnabled: useUIStore.getState().inputSpellcheckEnabled,
      theme: useUIStore.getState().theme,
      summaryThreshold: useUIStore.getState().summaryThreshold,
    };
    const templatesRef = useUIStore.getState().notificationTemplates;

    useUIStore.getState().setArrowKeyPromptHistoryEnabled(true);

    const after = {
      persistChatDraft: useUIStore.getState().persistChatDraft,
      inputSpellcheckEnabled: useUIStore.getState().inputSpellcheckEnabled,
      theme: useUIStore.getState().theme,
      summaryThreshold: useUIStore.getState().summaryThreshold,
    };
    expect(after).toEqual(before);
    expect(useUIStore.getState().notificationTemplates).toBe(templatesRef);
    expect(useUIStore.getState().arrowKeyPromptHistoryEnabled).toBe(true);

    useUIStore.getState().setArrowKeyPromptHistoryEnabled(false);
  });

  test('flipping the setting writes it into the persisted slice, on and off', async () => {
    // Durability contract (spec §6): the user's choice round-trips through the
    // zustand persist slice — same mechanism class as persistChatDraft.
    storage = new Map<string, string>();

    useUIStore.getState().setArrowKeyPromptHistoryEnabled(true);
    await flushPendingPersistWrites();
    expect(persistedPayload().arrowKeyPromptHistoryEnabled).toBe(true);

    useUIStore.getState().setArrowKeyPromptHistoryEnabled(false);
    await flushPendingPersistWrites();
    expect(persistedPayload().arrowKeyPromptHistoryEnabled).toBe(false);
  });

  test('a stored slice without the key rehydrates to false (no migration backfill)', async () => {
    // Upgrade scenario: an existing profile whose stored blob predates the
    // setting. The effective value must come from the store's own default
    // initializer — nothing in this scenario seeds it, so after an honest
    // rehydration of the keyless blob it must still read false.
    useUIStore.setState({ theme: 'system' });
    storage = new Map<string, string>();
    storage.set(STORAGE_KEY, JSON.stringify({
      state: { theme: 'dark' },
      version: CURRENT_STORE_VERSION,
    }));

    await useUIStore.persist.rehydrate();

    const state = useUIStore.getState();
    // Proves rehydration actually ran, so the false below is the preserved
    // default and not a no-op hydration.
    expect(state.theme).toBe('dark');
    expect(state.arrowKeyPromptHistoryEnabled).toBe(false);

    useUIStore.setState({ theme: 'system' });
  });
});
