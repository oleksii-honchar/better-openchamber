import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarkdownImageGrantsPath } from './bridge-localfs-proxy-path';

// ---------------------------------------------------------------------------
// RED for the stripped-`/api` grants-path bridge hole (Ad-Hoc Task 6 follow-up)
//
// The webview `window.fetch` wrapper sends API calls to the bridge with the leading
// `/api` stripped (`/openchamber/sessions/...`), while the host-side local fs
// proxy matcher only accepted the fully prefixed form. The generic forwarder
// then sent the stripped path to the OpenCode server, which has no such route ->
// 404 -> silent "preview not available". This mapper accepts BOTH forms and
// always returns the server (fully `/api`-prefixed) form, so the matcher
// and the forwarder share one contract.
// ---------------------------------------------------------------------------
describe('bridge-localfs-proxy-path (markdown-image-grants path mapping)', () => {
  test('maps the stripped webview path to the /api-prefixed server form', () => {
    assert.equal(
      normalizeMarkdownImageGrantsPath('/openchamber/sessions/ses_test_1/markdown-image-grants'),
      '/api/openchamber/sessions/ses_test_1/markdown-image-grants',
    );
  });

  test('keeps the fully prefixed form unchanged', () => {
    assert.equal(
      normalizeMarkdownImageGrantsPath('/api/openchamber/sessions/ses_test_1/markdown-image-grants'),
      '/api/openchamber/sessions/ses_test_1/markdown-image-grants',
    );
  });

  test('returns null for non-grants routes (e.g. fs/raw)', () => {
    assert.equal(normalizeMarkdownImageGrantsPath('/fs/raw'), null);
    assert.equal(normalizeMarkdownImageGrantsPath('/api/fs/stat'), null);
    assert.equal(normalizeMarkdownImageGrantsPath('/openchamber/sessions/ses_x/markdown'), null);
  });

  test('rejects session ids containing slashes', () => {
    assert.equal(normalizeMarkdownImageGrantsPath('/openchamber/sessions/a/b/markdown-image-grants'), null);
  });
});