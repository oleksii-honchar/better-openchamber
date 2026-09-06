import { describe, expect, it, mock, beforeEach, afterEach, setSystemTime } from 'bun:test';

// ---------------------------------------------------------------------------
// Task 8 — VS Code temp-dir grant forwarding/adaptation (ADR-5)
//
// The grants route is implemented locally in the VS Code runtime:
//   - workspace sources resolve through the existing local fs bridge
//     (resolveFileReadPath / /api/fs/stat + /api/fs/raw) — no new workspace surface
//   - temp-dir (outside-workspace) sources under approvedTempRoot
//     (os.tmpdir()/opencode) get a path-bound temp-dir grant minted against the
//     temp root, honored by /api/fs/raw WITHOUT widening resolveFileReadPath
//   - authority (assistant-message markdownImageSources + media inspection) is
//     forwarded to the OpenCode server's grants route — the renderer's
//     visibility never becomes authorization
// ---------------------------------------------------------------------------

// Force os.tmpdir() to a stable, mockable root on every platform.
process.env.TMPDIR = '/tmp';

const existingFiles = new Set();
const existingTempFiles = new Map(); // path -> Buffer
const fsPromises = {
  realpath: mock(async (filePath) => {
    if (existingFiles.has(filePath)) return filePath;
    if (existingTempFiles.has(filePath)) return filePath;
    const error = new Error('missing');
    error.code = 'ENOENT';
    throw error;
  }),
  stat: mock(async (filePath) => {
    if (existingFiles.has(filePath)) return { isFile: () => true, size: 4, mtimeMs: 1 };
    if (existingTempFiles.has(filePath)) {
      return { isFile: () => true, size: existingTempFiles.get(filePath).length, mtimeMs: 1 };
    }
    const error = new Error('missing');
    error.code = 'ENOENT';
    throw error;
  }),
  readFile: mock(async (filePath) => {
    if (existingTempFiles.has(filePath)) return existingTempFiles.get(filePath);
    return Buffer.from('test');
  }),
};

mock.module('fs', () => ({
  promises: fsPromises,
  default: { promises: fsPromises },
}));

mock.module('vscode', () => ({
  Uri: {
    file: (fsPath) => ({ fsPath }),
  },
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: '/workspace' } },
      { uri: { fsPath: '/workspace-two' } },
    ],
  },
}));

const { tryHandleLocalFsProxy } = await import('./bridge-localfs-proxy-runtime');

const MIB = 1024 * 1024;
const approvedTempRoot = '/tmp/opencode';
const API_URL = 'http://127.0.0.1:18765';
const tempVideo = `${approvedTempRoot}/media.mp4`;
const tempAudio = `${approvedTempRoot}/sound.mp3`;

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body),
  json: async () => body,
});

const withServerGrants = (results) => {
  const server = mock(async () => jsonResponse({ results }));
  globalThis.fetch = server;
  return server;
};

const buildGrantsRequest = (body) => ({
  bodyBase64: Buffer.from(JSON.stringify(body)).toString('base64'),
  headers: { authorization: 'Bearer test' },
  apiUrl: API_URL,
});

const grantsPath = '/api/openchamber/sessions/ses_1/markdown-image-grants';

const postGrants = (sources, overrides = {}) => tryHandleLocalFsProxy('POST', grantsPath, buildGrantsRequest({
  messageId: 'msg_1',
  sources,
  directory: '/workspace',
  ...overrides,
}));

const rawUrlFor = (targetPath, token) => {
  const params = new URLSearchParams({
    path: targetPath,
    directory: '/workspace',
    allowOutsideWorkspace: 'true',
  });
  if (token) params.set('outsideFileGrant', token);
  return `/api/fs/raw?${params.toString()}`;
};

beforeEach(() => {
  existingFiles.clear();
  existingTempFiles.clear();
  globalThis.fetch = mock(async () => jsonResponse({
    results: [{ source: tempVideo, status: 'ready', path: tempVideo, outsideWorkspace: true }],
  }));
});

afterEach(() => {
  delete globalThis.fetch;
});

describe('bridge local fs proxy', () => {
  it('no longer returns 501 for the Markdown grants route', async () => {
    const response = await postGrants(['/workspace/image.png']);

    expect(response?.status).not.toBe(501);
  });

  it('returns a quiet optional stat miss for missing files', async () => {
    const response = await tryHandleLocalFsProxy('GET', '/api/fs/stat?path=%2Fmissing.ts&optional=true');

    expect(response?.status).toBe(200);
    expect(JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'))).toEqual({
      path: '/missing.ts',
      exists: false,
    });
  });

  it('keeps regular stat miss behavior without optional flag', async () => {
    const response = await tryHandleLocalFsProxy('GET', '/api/fs/stat?path=%2Fmissing.ts');

    expect(response?.status).toBe(404);
  });

  it('reads from the active directory when it is the second workspace root', async () => {
    existingFiles.add('/workspace-two/image.png');
    const response = await tryHandleLocalFsProxy(
      'GET',
      '/api/fs/raw?path=%2Fworkspace-two%2Fimage.png&directory=%2Fworkspace-two',
    );

    expect(response?.status).toBe(200);
    expect(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString()).toBe('test');
  });

  // --- Task 8: grants route ---

  it('forwards the grants request to the server for authority and mints a temp-dir grant for temp sources', async () => {
    const server = globalThis.fetch;
    const response = await postGrants([tempVideo]);

    expect(response?.status).toBe(200);
    expect(server).toHaveBeenCalledTimes(1);
    const [fetchArg, fetchInit] = server.mock.calls[0];
    expect(String(fetchArg)).toContain('/api/openchamber/sessions/ses_1/markdown-image-grants');
    const sentBody = Buffer.from(fetchInit?.body ?? '', 'base64').toString('utf8');
    expect(sentBody).toContain('msg_1');

    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(payload.results?.[0]?.status).toBe('ready');
    expect(payload.results?.[0]?.path).toBe(tempVideo);
    expect(typeof payload.results?.[0]?.outsideFileGrant).toBe('string');
  });

  it('preserves workspace sources through the local fs bridge (no temp grant minted)', async () => {
    withServerGrants([
      { source: '/workspace/image.png', status: 'ready', path: '/workspace/image.png', outsideWorkspace: false },
    ]);
    const response = await postGrants(['/workspace/image.png']);

    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(response?.status).toBe(200);
    expect(payload.results?.[0]?.status).toBe('ready');
    expect(payload.results?.[0]?.outsideFileGrant).toBeUndefined();
  });

  it('returns error statuses from the server unchanged (missing / too-large / unsupported / outside-containment)', async () => {
    withServerGrants([
      { source: `${approvedTempRoot}/missing.mp4`, status: 'missing' },
      { source: `${approvedTempRoot}/big.mp4`, status: 'error' },
      { source: `${approvedTempRoot}/unsupported.xyz`, status: 'error' },
      { source: '/etc/passwd', status: 'error' },
    ]);
    const response = await postGrants([
      `${approvedTempRoot}/missing.mp4`,
      `${approvedTempRoot}/big.mp4`,
      `${approvedTempRoot}/unsupported.xyz`,
      '/etc/passwd',
    ]);

    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(payload.results?.map((r) => r.status)).toEqual(['missing', 'error', 'error', 'error']);
  });

  it('propagates server authority failures (source not in markdownImageSources)', async () => {
    withServerGrants([{ source: tempVideo, status: 'error' }]);
    const response = await postGrants([tempVideo]);

    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(payload.results?.[0]?.status).toBe('error');
  });

  // --- Task 8: /api/fs/raw honors temp-dir grants without widening the workspace bridge ---

  it('serves media bytes for a temp-dir grant path via /api/fs/raw', async () => {
    existingTempFiles.set(tempVideo, Buffer.from('media-bytes'));
    const grantResponse = await postGrants([tempVideo]);
    const payload = JSON.parse(Buffer.from(grantResponse?.bodyBase64 ?? '', 'base64').toString('utf8'));
    const token = payload.results?.[0]?.outsideFileGrant;
    expect(typeof token).toBe('string');

    const response = await tryHandleLocalFsProxy('GET', rawUrlFor(tempVideo, token));

    expect(response?.status).toBe(200);
    expect(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString()).toBe('media-bytes');
  });

  it('rejects a temp-dir path outside the grant (no widened workspace bridge)', async () => {
    existingTempFiles.set(tempVideo, Buffer.from('media-bytes'));
    const otherTemp = `${approvedTempRoot}/other.mp4`;
    existingTempFiles.set(otherTemp, Buffer.from('other-bytes'));
    const grantResponse = await postGrants([tempVideo]);
    const payload = JSON.parse(Buffer.from(grantResponse?.bodyBase64 ?? '', 'base64').toString('utf8'));
    const token = payload.results?.[0]?.outsideFileGrant;

    const response = await tryHandleLocalFsProxy('GET', rawUrlFor(otherTemp, token));

    expect(response?.status).toBe(403);
  });

  it('rejects a temp-dir raw read for a non-grant path (no grant token)', async () => {
    existingTempFiles.set(tempVideo, Buffer.from('media-bytes'));

    const response = await tryHandleLocalFsProxy('GET', rawUrlFor(tempVideo, undefined));

    expect(response?.status).toBe(403);
  });

  it('rejects a grants request missing messageId (failure state: missing)', async () => {
    const response = await tryHandleLocalFsProxy('POST', grantsPath, buildGrantsRequest({
      sources: [tempVideo],
      directory: '/workspace',
    }));

    expect(response?.status).toBe(400);
    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(payload.error).toContain('messageId');
  });

  it('leaves non-media / unknown proxy paths untouched (returns null)', async () => {
    const response = await tryHandleLocalFsProxy('GET', '/api/unknown');
    expect(response).toBeNull();
  });

  // Task 2: always-on any-path media (ADR-1) — no env flag
  it('mints a path-bound grant for an outside-workspace non-temp ready source (no env var)', async () => {
    const outsideFile = '/etc/media/image.png';
    withServerGrants([
      { source: outsideFile, status: 'ready', path: outsideFile, outsideWorkspace: true },
    ]);

    const response = await postGrants([outsideFile]);

    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(response?.status).toBe(200);
    expect(payload.results?.[0]?.status).toBe('ready');
    expect(typeof payload.results?.[0]?.outsideFileGrant).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Always-on any-path media (ADR-1)
//
// Outside-workspace non-temp media sources ALWAYS mint a path-bound grant
// scoped to the resolved path (allowedRoot=null). The grant is time-boxed
// (10 min) and requires an exact canonical-path match plus a valid token.
// No env flag is needed — this behavior is unconditional.
// ---------------------------------------------------------------------------

describe('Always-on any-path media (ADR-1)', () => {
  const anyPathFile = '/etc/media/image.png';
  const anyPathReady = {
    source: anyPathFile,
    status: 'ready',
    path: anyPathFile,
    outsideWorkspace: true,
  };

  it('mints a path-bound grant for an any-path `ready` result (path = canonical)', async () => {
    withServerGrants([anyPathReady]);

    const response = await postGrants([anyPathFile]);

    const payload = JSON.parse(Buffer.from(response?.bodyBase64 ?? '', 'base64').toString('utf8'));
    expect(response?.status).toBe(200);
    expect(payload.results?.[0]?.status).toBe('ready');
    expect(payload.results?.[0]?.path).toBe(anyPathFile);
    expect(typeof payload.results?.[0]?.outsideFileGrant).toBe('string');
  });

  it('/api/fs/raw serves any-path bytes through the path-bound grant; no token → 403', async () => {
    existingTempFiles.set(anyPathFile, Buffer.from('any-path-bytes'));
    withServerGrants([anyPathReady]);

    const grantResponse = await postGrants([anyPathFile]);
    const payload = JSON.parse(Buffer.from(grantResponse?.bodyBase64 ?? '', 'base64').toString('utf8'));
    const token = payload.results?.[0]?.outsideFileGrant;
    expect(typeof token).toBe('string');

    const served = await tryHandleLocalFsProxy('GET', rawUrlFor(anyPathFile, token));
    expect(served?.status).toBe(200);
    expect(Buffer.from(served?.bodyBase64 ?? '', 'base64').toString()).toBe('any-path-bytes');

    const denied = await tryHandleLocalFsProxy('GET', rawUrlFor(anyPathFile, undefined));
    expect(denied?.status).toBe(403);
  });

  it('grant TTL/expiry unchanged (expired token → 403)', async () => {
    existingTempFiles.set(anyPathFile, Buffer.from('any-path-bytes'));
    withServerGrants([anyPathReady]);

    const grantResponse = await postGrants([anyPathFile]);
    const payload = JSON.parse(Buffer.from(grantResponse?.bodyBase64 ?? '', 'base64').toString('utf8'));
    const token = payload.results?.[0]?.outsideFileGrant;
    expect(typeof token).toBe('string');

    setSystemTime(Date.now() + 600_001);
    try {
      const expired = await tryHandleLocalFsProxy('GET', rawUrlFor(anyPathFile, token));
      expect(expired?.status).toBe(403);
    } finally {
      setSystemTime();
    }
  });

  it('non-grant /api/fs/raw outside workspace still 403 (regression)', async () => {
    existingTempFiles.set(anyPathFile, Buffer.from('any-path-bytes'));

    const response = await tryHandleLocalFsProxy('GET', rawUrlFor(anyPathFile, undefined));

    expect(response?.status).toBe(403);
  });
});
