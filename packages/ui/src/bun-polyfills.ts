// Global polyfill for import.meta.glob used by Vite in useProviderLogo.ts
// This allows Bun to run tests without Vite's dev server APIs

interface PolyfillGlobals {
    import?: {
        meta?: {
            glob?: unknown;
        };
    };
}

if (typeof globalThis !== 'undefined') {
    const g = globalThis as PolyfillGlobals;
    const meta = g.import?.meta;
    if (!meta || !('glob' in meta)) {
        const importObj = g.import ?? {};
        const metaObj = importObj.meta ?? {};
        metaObj.glob = (): Record<string, () => Promise<unknown>> => ({});
        importObj.meta = metaObj;
        g.import = importObj;
    }
}
