/**
 * Normalize the VS Code webview's bridge path for the markdown-image-grants route.
 *
 * The webview `window.fetch` wrapper strips the leading `/api` from API paths
 * before bridging (it sends `/openchamber/sessions/...`), while the host-side
 * local fs proxy (and the OpenCode server grants route) expect the fully
 * prefixed form. This mapper accepts both forms and returns the server form,
 * or null when the path is not the grants route. Kept in its own module (no
 * `vscode` import) so it can be unit-tested without the extension host.

 * Examples:
 *   /openchamber/sessions/ses_x/markdown-image-grants -> /api/openchamber/sessions/ses_x/markdown-image-grants
 *   /api/openchamber/sessions/ses_x/markdown-image-grants -> (unchanged)
 *   /fs/raw -> null
 */
export const normalizeMarkdownImageGrantsPath = (pathname: string): string | null => {
  if (/^\/api\/openchamber\/sessions\/[^/]+\/markdown-image-grants$/.test(pathname)) {
    return pathname;
  }
  if (/^\/openchamber\/sessions\/[^/]+\/markdown-image-grants$/.test(pathname)) {
    return `/api${pathname}`;
  }
  return null;
};