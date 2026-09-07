import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getFsMimeType,
  isFsPathInsideWorkspace,
  normalizeFsPath,
  resolveFileReadPath,
  type FsReadPathResolution,
} from './bridge-fs-helpers-runtime';
import { normalizeMarkdownImageGrantsPath } from './bridge-localfs-proxy-path';

// ---------------------------------------------------------------------------
// Any-path media (ADR-1): always on, no env flag
//
// Outside-workspace non-temp media sources ALWAYS mint a path-bound grant
// scoped to the resolved path (allowedRoot=null). The grant is time-boxed
// (10 min) and requires an exact canonical-path match plus a valid token.
// ---------------------------------------------------------------------------

type ApiProxyResponsePayload = {
  status: number;
  headers: Record<string, string>;
  bodyBase64: string;
};

export type LocalFsProxyRequestOptions = {
  bodyBase64?: string;
  headers?: Record<string, string>;
  apiUrl?: string | null;
};

export const base64EncodeUtf8 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

export const collectHeaders = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

export const buildUnavailableApiResponse = (): ApiProxyResponsePayload => {
  const body = JSON.stringify({ error: 'OpenCode API unavailable' });
  return {
    status: 503,
    headers: { 'content-type': 'application/json' },
    bodyBase64: base64EncodeUtf8(body),
  };
};

export const sanitizeForwardHeaders = (input: Record<string, string> | undefined): Record<string, string> => {
  const headers: Record<string, string> = { ...(input || {}) };
  delete headers['content-length'];
  delete headers['host'];
  delete headers['connection'];
  return headers;
};

const buildProxyJsonError = (status: number, error: string): ApiProxyResponsePayload => ({
  status,
  headers: { 'content-type': 'application/json' },
  bodyBase64: base64EncodeUtf8(JSON.stringify({ error })),
});

const normalizeFsProxyPath = (pathname: string): '/api/fs/stat' | '/api/fs/read' | '/api/fs/raw' | null => {
  if (pathname === '/api/fs/stat' || pathname === '/fs/stat') return '/api/fs/stat';
  if (pathname === '/api/fs/read' || pathname === '/fs/read') return '/api/fs/read';
  if (pathname === '/api/fs/raw' || pathname === '/fs/raw') return '/api/fs/raw';
  return null;
};

// ---------------------------------------------------------------------------
// Temp-dir grant store (ADR-5/ADR-1)
//
// The VS Code extension is a privilege boundary. `resolveFileReadPath` stays
// workspace-only; the local fs bridge is NOT widened to arbitrary temp-dir
// paths. Instead the grants route mints a path-bound grant for outside-workspace
// media. Every grant is time-boxed (10 min, mirroring the server's
// OUTSIDE_FILE_GRANT_TTL_MS) and scoped to raw reads.
//
// Any-path media is ALWAYS ON (ADR-1): the same path-bound, time-boxed grant is
// minted for ANY resolved absolute path (allowedRoot=null) so any-path media is
// served identically, still never widening the workspace bridge and still
// requiring an exact canonical-path match plus a valid token.
// ---------------------------------------------------------------------------

const TEMP_DIR_GRANT_TTL_MS = 10 * 60 * 1000;
export const approvedTempRoot = path.join(os.tmpdir(), 'opencode');

type TempDirGrant = {
  canonicalPath: string;
  expiresAt: number;
};

const tempDirGrants = new Map<string, TempDirGrant>();

const pruneTempDirGrants = (): void => {
  const now = Date.now();
  for (const [token, grant] of tempDirGrants.entries()) {
    if (!grant || grant.expiresAt <= now) {
      tempDirGrants.delete(token);
    }
  }
};

const isWithin = (target: string, root: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const mintTempDirGrant = (targetPath: string, allowedRoot: string | null = approvedTempRoot): string | null => {
  const raw = typeof targetPath === 'string' ? targetPath.trim() : '';
  if (!raw) return null;
  const canonicalPath = path.resolve(raw);
  if (allowedRoot && !isWithin(canonicalPath, allowedRoot)) return null;
  pruneTempDirGrants();
  const token = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  tempDirGrants.set(token, { canonicalPath, expiresAt: Date.now() + TEMP_DIR_GRANT_TTL_MS });
  return token;
};

const resolveTempDirRawGrant = async ({
  token,
  targetPath,
  allowedRoot = approvedTempRoot,
}: {
  token: string | undefined;
  targetPath: string;
  allowedRoot?: string | null;
}): Promise<{ ok: true; canonicalPath: string } | { ok: false; status: number; error: string }> => {
  if (!token || !token.trim()) {
    return { ok: false, status: 403, error: 'Outside workspace file access requires a grant' };
  }
  pruneTempDirGrants();
  const grant = tempDirGrants.get(token.trim());
  if (!grant) {
    return { ok: false, status: 403, error: 'Outside workspace file grant is invalid or expired' };
  }
  try {
    const canonicalPath = await fs.promises.realpath(targetPath);
    if ((allowedRoot && !isWithin(canonicalPath, allowedRoot)) || canonicalPath !== grant.canonicalPath) {
      return { ok: false, status: 403, error: 'Outside workspace file grant does not match requested path' };
    }
    return { ok: true, canonicalPath };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      return { ok: false, status: 404, error: 'File not found' };
    }
    return { ok: false, status: 403, error: 'Access to file denied' };
  }
};

const decodeGrantBody = (options?: LocalFsProxyRequestOptions): { messageId?: string; sources: string[]; directory?: string } | null => {
  const raw = options?.bodyBase64;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const body = parsed as Record<string, unknown>;
  const sources = Array.isArray(body.sources)
    ? body.sources.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  return {
    messageId: typeof body.messageId === 'string' && body.messageId.trim() ? body.messageId.trim() : undefined,
    sources,
    directory: typeof body.directory === 'string' && body.directory.trim() ? body.directory.trim() : undefined,
  };
};

const fetchServerGrants = async (requestPath: string, options?: LocalFsProxyRequestOptions): Promise<ApiProxyResponsePayload | null> => {
  const apiUrl = options?.apiUrl;
  if (!apiUrl) return null;
  const parsed = new URL(requestPath, 'https://openchamber.local');
  const base = `${apiUrl.replace(/\/+$/, '')}/`;
  const targetUrl = new URL(parsed.pathname.replace(/^\/+/, ''), base).toString();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...sanitizeForwardHeaders(options?.headers),
  };
  const body = typeof options?.bodyBase64 === 'string' && options.bodyBase64.length > 0
    ? Buffer.from(options.bodyBase64, 'base64')
    : undefined;
  try {
    const response = await fetch(targetUrl, { method: 'POST', headers, body });
    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    const bodyText = contentType.includes('json') ? await response.text() : null;
    return {
      status: response.status,
      headers: { 'content-type': 'application/json' },
      bodyBase64: base64EncodeUtf8(bodyText ?? ''),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach OpenCode API';
    return buildProxyJsonError(502, message);
  }
};

const handleMarkdownImageGrantsProxy = async (
  method: string,
  requestPath: string,
  options?: LocalFsProxyRequestOptions,
): Promise<ApiProxyResponsePayload> => {
  if (method !== 'POST') {
    return buildProxyJsonError(405, 'Method not allowed');
  }
  const body = decodeGrantBody(options);
  if (!body || body.sources.length === 0 || !body.messageId) {
    return buildProxyJsonError(400, 'sessionId, messageId, and 1-12 sources are required');
  }

  const serverResponse = await fetchServerGrants(requestPath, options);
  if (!serverResponse) {
    return buildProxyJsonError(503, 'OpenCode API unavailable');
  }
  if (serverResponse.status !== 200) {
    return serverResponse;
  }

  let payload: { results?: Array<Record<string, unknown>> };
  try {
    payload = JSON.parse(Buffer.from(serverResponse.bodyBase64, 'base64').toString('utf8')) as {
      results?: Array<Record<string, unknown>>;
    };
  } catch {
    return buildProxyJsonError(502, 'Invalid grants response from OpenCode');
  }
  const results = Array.isArray(payload.results) ? payload.results : [];

  const adaptedResults = [];
  for (const result of results) {
    const source = typeof result.source === 'string' ? result.source : '';
    if (!source) {
      adaptedResults.push(result);
      continue;
    }
    if (result.status !== 'ready') {
      adaptedResults.push(result);
      continue;
    }
    const serverPath = typeof result.path === 'string' ? result.path : source;
    const resolved = path.isAbsolute(serverPath) ? serverPath : path.resolve(body.directory ?? '', serverPath);
    if (isWithin(resolved, approvedTempRoot)) {
      // Outside-workspace temp media: keep the server's authority but serve the
      // bytes through a path-bound temp-dir grant scoped to approvedTempRoot.
      const token = mintTempDirGrant(resolved, approvedTempRoot);
      if (!token) {
        adaptedResults.push({ source, status: 'error' });
        continue;
      }
      adaptedResults.push({
        source,
        status: 'ready',
        path: resolved,
        outsideFileGrant: token,
      });
      continue;
    }
    if (isFsPathInsideWorkspace(resolved, body.directory)) {
      // Workspace source: preserve the server result, but drop any outside grant —
      // workspace media flows through the existing local fs bridge.
      const workspaceResult = { ...result };
      delete workspaceResult.outsideFileGrant;
      adaptedResults.push(workspaceResult);
      continue;
    }
    // Any-path media (ADR-1): always-on — mint a path-bound, time-boxed grant
    // for the resolved absolute path (allowedRoot=null) so it serves through the
    // raw bridge without widening the workspace surface.
    const token = mintTempDirGrant(resolved, null);
    if (!token) {
      adaptedResults.push({ source, status: 'error' });
      continue;
    }
    adaptedResults.push({
      source,
      status: 'ready',
      path: resolved,
      outsideFileGrant: token,
    });
  }

  return {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    bodyBase64: base64EncodeUtf8(JSON.stringify({ results: adaptedResults })),
  };
};

export const tryHandleLocalFsProxy = async (method: string, requestPath: string, options?: LocalFsProxyRequestOptions): Promise<ApiProxyResponsePayload | null> => {
  let parsed: URL;
  try {
    parsed = new URL(requestPath, 'https://openchamber.local');
  } catch {
    return buildProxyJsonError(400, 'Invalid request path');
  }

  const grantsPath = normalizeMarkdownImageGrantsPath(parsed.pathname);
  if (grantsPath) {
    return handleMarkdownImageGrantsProxy(method, grantsPath, options);
  }

  const fsProxyPath = normalizeFsProxyPath(parsed.pathname);
  if (!fsProxyPath) {
    return null;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return buildProxyJsonError(405, 'Method not allowed');
  }

  const targetPath = parsed.searchParams.get('path') || '';
  const optional = parsed.searchParams.get('optional') === 'true';

  // Temp-dir/any-path grant path (ADR-5/ADR-1): honor ONLY a path-bound grant
  // — any path the grant names — without widening resolveFileReadPath
  // (workspace-only).
  if (parsed.searchParams.get('allowOutsideWorkspace') === 'true') {
    const grantResolution = await resolveTempDirRawGrant({
      token: parsed.searchParams.get('outsideFileGrant') ?? undefined,
      targetPath,
      allowedRoot: null,
    });
    if (grantResolution.ok) {
      if (fsProxyPath !== '/api/fs/raw' && fsProxyPath !== '/api/fs/stat') {
        return buildProxyJsonError(403, 'Access to file denied');
      }
      try {
        const stats = await fs.promises.stat(grantResolution.canonicalPath);
        if (!stats.isFile()) {
          return buildProxyJsonError(400, 'Specified path is not a file');
        }
        if (fsProxyPath === '/api/fs/stat') {
          return {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
            bodyBase64: base64EncodeUtf8(JSON.stringify({
              path: normalizeFsPath(grantResolution.canonicalPath),
              isFile: true,
              size: stats.size,
              mtimeMs: stats.mtimeMs,
            })),
          };
        }
        const raw = await fs.promises.readFile(grantResolution.canonicalPath);
        return {
          status: 200,
          headers: { 'content-type': getFsMimeType(grantResolution.canonicalPath), 'cache-control': 'no-store' },
          bodyBase64: Buffer.from(raw).toString('base64'),
        };
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code === 'ENOENT') return buildProxyJsonError(404, 'File not found');
        return buildProxyJsonError(500, 'Unable to read file');
      }
    }
    return buildProxyJsonError(grantResolution.status, grantResolution.error);
  }

  const directoryHint =
    options?.headers?.['x-opencode-directory'] ??
    (parsed.searchParams.get('directory') || undefined);

  const resolution: FsReadPathResolution = await resolveFileReadPath(
    targetPath,
    directoryHint,
  );
  if (!resolution.ok) {
    if (fsProxyPath === '/api/fs/stat' && optional && resolution.status === 404) {
      return {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
        bodyBase64: base64EncodeUtf8(JSON.stringify({ path: targetPath, exists: false })),
      };
    }
    return buildProxyJsonError(resolution.status, resolution.error);
  }

  try {
    const stats = await fs.promises.stat(resolution.resolvedPath);
    if (!stats.isFile()) {
      return buildProxyJsonError(400, 'Specified path is not a file');
    }

    if (fsProxyPath === '/api/fs/stat') {
      return {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
        bodyBase64: base64EncodeUtf8(JSON.stringify({
          path: normalizeFsPath(resolution.resolvedPath),
          isFile: true,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
        })),
      };
    }

    if (fsProxyPath === '/api/fs/read') {
      const content = await fs.promises.readFile(resolution.resolvedPath, 'utf8');
      return {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        },
        bodyBase64: base64EncodeUtf8(content),
      };
    }

    const raw = await fs.promises.readFile(resolution.resolvedPath);
    return {
      status: 200,
      headers: {
        'content-type': getFsMimeType(resolution.resolvedPath),
        'cache-control': 'no-store',
      },
      bodyBase64: Buffer.from(raw).toString('base64'),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      if (fsProxyPath === '/api/fs/stat' && optional) {
        return {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
          bodyBase64: base64EncodeUtf8(JSON.stringify({ path: targetPath, exists: false })),
        };
      }
      return buildProxyJsonError(404, 'File not found');
    }
    if (fsProxyPath === '/api/fs/stat') {
      return buildProxyJsonError(500, 'Unable to stat file');
    }
    return buildProxyJsonError(500, 'Unable to read file');
  }
};
