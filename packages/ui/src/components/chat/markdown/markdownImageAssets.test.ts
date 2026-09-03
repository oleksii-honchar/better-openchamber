import { describe, expect, mock, test } from 'bun:test';

let requestCount = 0;
let requestPaths: string[] = [];
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);
const MIB = 1024 * 1024;
// `ftyp` at offset 4 (mp4/m4a), `EBML` (webm), `ID3` (audio), `RIFF....WAVE` (wav).
const MP4_HEADER = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const WEBM_HEADER = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm', 'utf8')]);
const ID3_HEADER = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'utf8');
const WAVE_HEADER = Buffer.concat([Buffer.from('RIFF', 'utf8'), Buffer.from([0x00, 0x00, 0x00, 0x00]), Buffer.from('WAVE', 'utf8')]);
let statSize = PNG.byteLength;
let rawBody: Uint8Array<ArrayBuffer> = new Uint8Array(PNG);
let rawContentType = 'image/png';
let rawContentLength: number | undefined;
const runtimeFetch = mock(async (path: string, init?: RequestInit & { query?: Record<string, unknown> }) => {
  requestPaths.push(path);
  if (path === '/api/fs/stat') {
    return new Response(JSON.stringify({ isFile: true, size: statSize }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (path === '/api/fs/raw') {
    const headers: Record<string, string> = { 'content-type': rawContentType };
    if (rawContentLength !== undefined) headers['content-length'] = String(rawContentLength);
    return new Response(rawBody, { status: 200, headers });
  }
  requestCount += 1;
  const body = JSON.parse(String(init?.body)) as { sources: string[] };
  return new Response(JSON.stringify({
    results: body.sources.map((source) => ({ source, status: 'ready', path: `/repo/${source}` })),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
});
const resolver = {
  api: () => '',
  authenticatedAsset: (path: string, query: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return `${path}?${params}`;
  },
};

mock.module('@/lib/runtime-fetch', () => ({ runtimeFetch }));
mock.module('@/lib/runtime-url', () => ({ getRuntimeUrlResolver: () => resolver }));

class TestFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload?.();
    }).catch((error) => {
      this.error = error as DOMException;
      this.onerror?.();
    });
  }
}

globalThis.FileReader = TestFileReader as unknown as typeof FileReader;

const {
  getPreparedMarkdownImageUrl,
  prepareLocalMarkdownImages,
  resolveWorkspaceMarkdownImageSource,
  resolveMarkdownImageSource,
} = await import('./markdownImageAssets');

const verifyRejects = async (promise: Promise<unknown>, expectedMessage?: string): Promise<void> => {
  const error: unknown = await promise.then(
    () => { throw new Error('Expected validation to fail'); },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Error);
  if (expectedMessage !== undefined) expect((error as Error).message).toBe(expectedMessage);
};

describe('Markdown image asset preparation', () => {
  test('prepares many images in one message-level request', async () => {
    requestCount = 0;
    const sources = Array.from({ length: 12 }, (_, index) => `${index}.png`);

    const result = await prepareLocalMarkdownImages({
      sources,
      directory: '/repo',
      sessionId: 'ses_batch',
      messageId: 'msg_batch',
      signal: new AbortController().signal,
    });

    expect(result.size).toBe(12);
    expect(requestCount).toBe(1);
  });

  test('reuses preparation for one thousand messages after virtualized remounts', async () => {
    requestCount = 0;
    const requests = Array.from({ length: 1000 }, (_, index) => ({
      sources: [`${index}.png`],
      directory: '/repo',
      sessionId: 'ses_long',
      messageId: `msg_${index}`,
      signal: new AbortController().signal,
    }));

    for (const request of requests) await prepareLocalMarkdownImages(request);
    for (const request of requests) await prepareLocalMarkdownImages(request);

    expect(requestCount).toBe(1000);
  });

  test('reuses the existing authenticated raw-file asset URL', () => {
    const url = getPreparedMarkdownImageUrl({
      status: 'ready',
      path: '/tmp/opencode/image.png',
      outsideFileGrant: 'grant-1',
    }, '/repo');

    expect(url).toContain('/api/fs/raw?');
    expect(url).toContain('path=%2Ftmp%2Fopencode%2Fimage.png');
    expect(url).toContain('outsideFileGrant=grant-1');
  });

  test('loads a workspace image through the local filesystem bridge', async () => {
    requestPaths = [];

    const url = await resolveWorkspaceMarkdownImageSource(
      'screens/image.png',
      '/repo',
      new AbortController().signal,
    );

    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(requestPaths).toEqual(['/api/fs/stat', '/api/fs/raw']);
  });
});

describe('Markdown media validation', () => {
  const loadMedia = (source: string) => resolveWorkspaceMarkdownImageSource(source, '/repo', new AbortController().signal);

  const setRaw = (body: Uint8Array, contentType: string, options?: { statSize?: number; contentLength?: number }) => {
    rawBody = new Uint8Array(body);
    rawContentType = contentType;
    statSize = options?.statSize ?? body.byteLength;
    rawContentLength = options?.contentLength;
  };

  test('accepts video/mp4 with an ftyp signature', async () => {
    setRaw(MP4_HEADER, 'video/mp4');
    const url = await loadMedia('clip.mp4');
    expect(url.startsWith('data:video/mp4;base64,')).toBe(true);
  });

  test('accepts video/webm with an EBML signature', async () => {
    setRaw(WEBM_HEADER, 'video/webm');
    const url = await loadMedia('clip.webm');
    expect(url.startsWith('data:video/webm;base64,')).toBe(true);
  });

  test('accepts audio/mpeg with an ID3 signature', async () => {
    setRaw(ID3_HEADER, 'audio/mpeg');
    const url = await loadMedia('track.mp3');
    expect(url.startsWith('data:audio/mpeg;base64,')).toBe(true);
  });

  test('accepts audio/wav with a RIFF/WAVE signature', async () => {
    setRaw(WAVE_HEADER, 'audio/wav');
    const url = await loadMedia('track.wav');
    expect(url.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  test('rejects media whose declared type does not match its signature', async () => {
    setRaw(PNG, 'video/mp4');
    await verifyRejects(loadMedia('clip.mp4'), 'Unsupported image data');
  });

  test('enforces the per-kind video cap on stat, content-length, and blob size', async () => {
    // 30 MiB video accepted (content-length reports the full size).
    setRaw(MP4_HEADER, 'video/mp4', { statSize: 30 * MIB, contentLength: 30 * MIB });
    expect((await loadMedia('clip.mp4')).startsWith('data:video/mp4;base64,')).toBe(true);

    // >50 MiB video rejected via content-length.
    setRaw(MP4_HEADER, 'video/mp4', { contentLength: 50 * MIB + 1 });
    await verifyRejects(loadMedia('clip.mp4'), 'Image is too large');

    // >50 MiB video rejected via stat size (same shared cap).
    setRaw(MP4_HEADER, 'video/mp4', { statSize: 50 * MIB + 1 });
    await verifyRejects(loadMedia('clip.mp4'), 'Image is too large');
  });

  test('enforces the per-kind audio cap with 19 MiB accepted and >20 MiB rejected', async () => {
    setRaw(ID3_HEADER, 'audio/mpeg', { statSize: 19 * MIB, contentLength: 19 * MIB });
    expect((await loadMedia('track.mp3')).startsWith('data:audio/mpeg;base64,')).toBe(true);

    setRaw(ID3_HEADER, 'audio/mpeg', { statSize: 20 * MIB + 1 });
    await verifyRejects(loadMedia('track.mp3'), 'Image is too large');

    setRaw(ID3_HEADER, 'audio/mpeg', { contentLength: 20 * MIB + 1 });
    await verifyRejects(loadMedia('track.mp3'), 'Image is too large');
  });

  test('keeps the image cap at >10 MiB rejected (existing behavior)', async () => {
    setRaw(PNG, 'image/png', { statSize: 10 * MIB + 1 });
    await verifyRejects(loadMedia('large.png'), 'Image is too large');
  });

  test('keeps data-URL validation image-only (video/audio data URLs rejected)', async () => {
    const signal = new AbortController().signal;
    expect(await resolveMarkdownImageSource(`data:image/png;base64,${PNG.toString('base64')}`, signal))
      .toBe(`data:image/png;base64,${PNG.toString('base64')}`);

    await verifyRejects(resolveMarkdownImageSource('data:video/mp4;base64,AAAA', new AbortController().signal));
    await verifyRejects(resolveMarkdownImageSource('data:audio/mpeg;base64,AAAA', new AbortController().signal));
  });
});
