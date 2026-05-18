// Global polyfill for import.meta.glob used by Vite in useProviderLogo.ts
// This allows Bun to run tests without Vite's dev server APIs

if (typeof globalThis !== 'undefined' && !('glob' in ((globalThis as any).import?.meta || {}))) {
  // @ts-ignore - Adding glob polyfill for Bun test compatibility
  (globalThis as any).import = (globalThis as any).import || {};
  // @ts-ignore  
  (globalThis as any).import.meta = (globalThis as any).import.meta || {};
  // @ts-ignore - Polyfill import.meta.glob to return empty record for Bun tests
  (globalThis as any).import.meta.glob = <T extends string>(): Record<T, () => Promise<unknown>> => ({});
}
