// Polyfill import.meta.glob for Bun test compatibility
if (typeof import.meta.glob !== 'function') {
  (globalThis as any).import = globalThis.import || {};
  (globalThis as any).import.meta = globalThis.import.meta || {};
  
  // @ts-ignore - defining glob manually for environments that don't have it
  import.meta.glob = <T extends string>(glob: string, options?: any) => {
    return {} as Record<T, () => Promise<unknown>>;
  };
}

export {};
