import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerMarkdownImageGrantRoutes } from './routes.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);
const MIB = 1024 * 1024;

// Container signatures mirror the renderer's `hasMediaSignature` (Task 6) — see
// the parity test below which asserts both sides agree on caps + MIME set.
const MP4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypmp42')]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm')]);
const MP3 = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00');
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
// m4a is an ISO Base Media container (audio/mp4) — `ftyp` box at offset 4,
// same signature as mp4. The renderer (`markdownImageAssets.ts`) accepts it;
// the grant route must too (reviewer Issue #1).
const M4A = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x20]), Buffer.from('ftypM4A ')]);

// Grant-route caps (this package) — mirrored from the renderer (Task 6) numbers.
const GRANT_ROUTE_MEDIA_SIZE_CAPS = {
  image: 10 * MIB,
  video: 50 * MIB,
  audio: 20 * MIB,
};
// MIME types the grant route can classify by extension (image kinds keep the
// existing `hasImageSignature` set; video/audio added per Task 7).
const GRANT_ROUTE_MEDIA_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4', // m4a container (ftyp signature)
]);

const roots = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

const createFixture = async ({ sources, markdown, contents } = {}) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openchamber-session-assets-'));
  roots.push(root);
  const approvedTempRoot = path.join(root, 'opencode');
  const directory = path.join(root, 'workspace');
  await Promise.all([
    fs.mkdir(approvedTempRoot, { recursive: true }),
    fs.mkdir(directory, { recursive: true }),
  ]);
  const defaultPath = path.join(approvedTempRoot, 'image.png');
  await fs.writeFile(defaultPath, PNG);
  const requestedSources = sources ?? [new URL(`file://${defaultPath}`).toString()];
  const text = markdown ?? requestedSources.map((source) => `![image](${source})`).join('\n');
  if (contents) {
    await Promise.all([...contents.entries()].map(async ([filename, data]) => {
      const target = path.resolve(directory, filename);
      if (!isUnder(target, directory)) return;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
    }));
  }
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    info: { id: 'msg_1', role: 'assistant' },
    parts: [{ type: 'text', text }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);

  let fullReadCount = 0;
  const app = express();
  registerMarkdownImageGrantRoutes(app, {
    fsPromises: {
      ...fs,
      readFile: async (...args) => {
        fullReadCount += 1;
        return fs.readFile(...args);
      },
    },
    path,
    os,
    crypto,
    approvedTempRoot,
    validateDirectoryPath: async (candidate) => candidate === directory
      ? { ok: true, directory }
      : { ok: false, error: 'Invalid directory' },
    buildOpenCodeUrl: (route) => `http://opencode.test${route}`,
    getOpenCodeAuthHeaders: () => ({ authorization: 'Basic test' }),
  });
  return {
    app,
    approvedTempRoot,
    directory,
    fetchMock,
    fullReadCount: () => fullReadCount,
    root,
    sources: requestedSources,
  };
};

const prepare = (app, directory, sources) => request(app)
  .post('/api/openchamber/sessions/ses_1/markdown-image-grants')
  .send({ directory, messageId: 'msg_1', sources })
  .expect(200);

const isUnder = (target, root) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

describe('session image assets', () => {
  it('prepares workspace and OpenCode temporary images with one message fetch', async () => {
    const fixture = await createFixture({ sources: ['workspace.png'] });
    await fs.writeFile(path.join(fixture.directory, 'workspace.png'), PNG);
    const temporaryPath = path.join(fixture.approvedTempRoot, 'temporary.png');
    await fs.writeFile(temporaryPath, PNG);
    const temporarySource = new URL(`file://${temporaryPath}`).toString();
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: `![workspace](workspace.png)\n![temporary](${temporarySource})` }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(fixture.app, fixture.directory, ['workspace.png', temporarySource]);

    expect(fixture.fetchMock).toHaveBeenCalledTimes(1);
    expect(fixture.fullReadCount()).toBe(0);
    expect(response.body.results).toHaveLength(2);
    const canonicalTemporaryPath = await fs.realpath(temporaryPath);
    expect(response.body.results[0]).toEqual({
      source: 'workspace.png',
      status: 'ready',
      path: path.join(fixture.directory, 'workspace.png'),
    });
    expect(response.body.results[1]).toEqual(expect.objectContaining({
      source: temporarySource,
      status: 'ready',
      path: canonicalTemporaryPath,
      outsideFileGrant: expect.any(String),
      expiresAt: expect.any(Number),
    }));
  });

  it('returns partial results without letting one missing image block valid images', async () => {
    const fixture = await createFixture({ sources: ['present.png', 'deleted.png'] });
    await fs.writeFile(path.join(fixture.directory, 'present.png'), PNG);

    const response = await prepare(fixture.app, fixture.directory, fixture.sources);

    expect(response.body.results).toEqual([
      expect.objectContaining({ source: 'present.png', status: 'ready' }),
      { source: 'deleted.png', status: 'missing' },
    ]);
  });

  it('resolves encoded workspace paths without treating query or fragment text as a filename', async () => {
    const source = 'screen%20shot.png?version=1#preview';
    const fixture = await createFixture({ sources: [source] });
    await fs.writeFile(path.join(fixture.directory, 'screen shot.png'), PNG);

    const response = await prepare(fixture.app, fixture.directory, fixture.sources);

    expect(response.body.results).toEqual([
      expect.objectContaining({ source, status: 'ready' }),
    ]);
  });

  it('authorizes reference-style image syntax using its resolved destination', async () => {
    const source = 'reference.png';
    const fixture = await createFixture({
      sources: [source],
      markdown: '![screenshot][result]\n\n[result]: reference.png',
    });
    await fs.writeFile(path.join(fixture.directory, source), PNG);

    const response = await prepare(fixture.app, fixture.directory, fixture.sources);

    expect(response.body.results).toEqual([
      expect.objectContaining({ source, status: 'ready' }),
    ]);
  });

  it('authorizes inline image destinations containing balanced parentheses', async () => {
    const source = 'screen(1).png';
    const fixture = await createFixture({
      sources: [source],
      markdown: `![screenshot](${source})`,
    });
    await fs.writeFile(path.join(fixture.directory, source), PNG);

    const response = await prepare(fixture.app, fixture.directory, fixture.sources);

    expect(response.body.results).toEqual([
      expect.objectContaining({ source, status: 'ready' }),
    ]);
  });

  it('requires inline image destinations with titles to close', async () => {
    const sources = ['valid.png', 'malformed.png'];
    const fixture = await createFixture({
      sources,
      markdown: '![valid](valid.png "preview")\n![malformed](malformed.png "preview"',
    });
    await Promise.all(sources.map((source) => fs.writeFile(path.join(fixture.directory, source), PNG)));

    const response = await prepare(fixture.app, fixture.directory, sources);

    expect(response.body.results).toEqual([
      expect.objectContaining({ source: 'valid.png', status: 'ready' }),
      { source: 'malformed.png', status: 'error' },
    ]);
  });

  it('rejects a source that the message does not reference', async () => {
    const fixture = await createFixture({ markdown: 'No image here.' });
    const response = await prepare(fixture.app, fixture.directory, fixture.sources);
    expect(response.body.results).toEqual([{ source: fixture.sources[0], status: 'error' }]);
  });

  it('does not authorize image syntax inside fenced or inline code', async () => {
    const fixture = await createFixture({
      markdown: '```md\n![fenced](FENCED)\n```\n`![inline](INLINE)`',
    });
    const sources = ['FENCED', 'INLINE'];

    const response = await prepare(fixture.app, fixture.directory, sources);

    expect(response.body.results).toEqual(sources.map((source) => ({ source, status: 'error' })));
  });

  it('rejects non-image bytes while serving symlink-resolved images per source', async () => {
    const fixture = await createFixture({ sources: ['invalid.png', 'linked.png'] });
    await fs.writeFile(path.join(fixture.directory, 'invalid.png'), 'not an image');
    await fs.writeFile(path.join(fixture.root, 'outside.png'), PNG);
    await fs.symlink(path.join(fixture.root, 'outside.png'), path.join(fixture.directory, 'linked.png'));

    const response = await prepare(fixture.app, fixture.directory, fixture.sources);
    expect(response.body.results).toEqual([
      { source: 'invalid.png', status: 'error' },
      expect.objectContaining({ source: 'linked.png', status: 'ready' }),
    ]);
  });
});

describe('session media assets (Task 7)', () => {
  const MEDIA = [
    { filename: 'clip.mp4', bytes: MP4, kind: 'video', mime: 'video/mp4' },
    { filename: 'clip.webm', bytes: WEBM, kind: 'video', mime: 'video/webm' },
    { filename: 'song.mp3', bytes: MP3, kind: 'audio', mime: 'audio/mpeg' },
    { filename: 'song.wav', bytes: WAV, kind: 'audio', mime: 'audio/wav' },
  ];

  const asFileSource = (pathName) => new URL(`file://${pathName}`).toString();

  it('prepares mp4/webm/mp3/wav sources under approvedTempRoot with outsideFileGrant', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const sources = MEDIA.map(({ filename, bytes }) => {
      const target = path.join(fixture.approvedTempRoot, filename);
      return { filename, bytes, target, source: asFileSource(target) };
    });
    await Promise.all(sources.map(({ target, bytes }) => fs.writeFile(target, bytes)));
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: sources.map(({ source }) => `![media](${source})`).join('\n') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(
      fixture.app,
      fixture.directory,
      sources.map(({ source }) => source),
    );

    expect(fixture.fullReadCount()).toBe(0);
    expect(response.body.results).toHaveLength(4);
    for (const { source, target } of sources) {
      const canonical = await fs.realpath(target);
      const result = response.body.results.find((entry) => entry.source === source);
      expect(result).toEqual(expect.objectContaining({
        source,
        status: 'ready',
        path: canonical,
        outsideFileGrant: expect.any(String),
        expiresAt: expect.any(Number),
      }));
    }
  });

  it('enforces per-kind size caps with 30 MiB video ready and >50 MiB/>20 MiB/>10 MiB error', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    // Use valid container signatures so only the size cap decides the outcome.
    // (The ready 30 MiB video must pass signature; the >cap files fail on size.)
    const withSignature = (bytes, ...header) => {
      const buffer = Buffer.alloc(bytes);
      header.forEach((part, index) => part.copy(buffer, index * 12));
      return buffer;
    };
    const MP4_HEADER = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(4)]);
    const MP3_HEADER = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00');
    const PNG_HEADER = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(4)]);
    const cases = [
      { filename: 'ok-30mib.mp4', bytes: withSignature(30 * MIB, MP4_HEADER), kind: 'video', expect: 'ready' },
      // Strictly greater than the cap (the grant rejects `size > cap`).
      { filename: 'too-big-50mib.mp4', bytes: withSignature(50 * MIB + 1, MP4_HEADER), kind: 'video', expect: 'error' },
      { filename: 'too-big-20mib.mp3', bytes: withSignature(20 * MIB + 1, MP3_HEADER), kind: 'audio', expect: 'error' },
      { filename: 'too-big-10mib.png', bytes: withSignature(10 * MIB + 1, PNG_HEADER), kind: 'image', expect: 'error' },
    ];
    const sources = cases.map(({ filename, bytes }) => {
      const target = path.join(fixture.approvedTempRoot, filename);
      return { filename, bytes, target, source: asFileSource(target) };
    });
    await Promise.all(sources.map(({ target, bytes }) => fs.writeFile(target, bytes)));
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: sources.map(({ source }) => `![media](${source})`).join('\n') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(
      fixture.app,
      fixture.directory,
      sources.map(({ source }) => source),
    );

    for (let index = 0; index < cases.length; index += 1) {
      const entry = response.body.results.find((result) => result.source === sources[index].source);
      if (cases[index].expect === 'ready') {
        expect(entry).toEqual(expect.objectContaining({
          source: sources[index].source,
          status: 'ready',
          path: await fs.realpath(sources[index].target),
          outsideFileGrant: expect.any(String),
          expiresAt: expect.any(Number),
        }));
      } else {
        expect(entry).toEqual({ source: sources[index].source, status: 'error' });
      }
    }
  });

  it('prepares m4a (audio/mp4, ftyp signature) sources under approvedTempRoot', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const target = path.join(fixture.approvedTempRoot, 'song.m4a');
    await fs.writeFile(target, M4A);
    const source = asFileSource(target);
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: `![media](${source})` }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([expect.objectContaining({
      source,
      status: 'ready',
      path: await fs.realpath(target),
      outsideFileGrant: expect.any(String),
      expiresAt: expect.any(Number),
    })]);
  });

  it('rejects trimmed audio extensions (ogg/oga/aac/flac → error, no dead promise)', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    // Plausible native-container bytes for each extension — these are rejected
    // by classification alone (the extensions are trimmed from KIND_BY_EXTENSION
    // on both grant route and renderer, so no signature/MIME support is claimed).
    const cases = [
      { filename: 'track.ogg', bytes: Buffer.from('OggS\x00\x02', 'ascii') },
      { filename: 'track.oga', bytes: Buffer.from('OggS\x00\x02', 'ascii') },
      { filename: 'track.aac', bytes: Buffer.from([0xff, 0xf1, 0x50, 0x80]) },
      { filename: 'track.flac', bytes: Buffer.from('fLaC', 'ascii') },
    ];
    const sources = cases.map(({ filename, bytes }) => {
      const target = path.join(fixture.approvedTempRoot, filename);
      return { target, bytes, source: asFileSource(target) };
    });
    await Promise.all(sources.map(({ target, bytes }) => fs.writeFile(target, bytes)));
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: sources.map(({ source }) => `![media](${source})`).join('\n') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(
      fixture.app,
      fixture.directory,
      sources.map(({ source }) => source),
    );

    expect(response.body.results).toEqual(
      sources.map(({ source }) => ({ source, status: 'error' })),
    );
  });

  it('rejects a signature mismatch (PNG bytes labeled .mp4)', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const target = path.join(fixture.approvedTempRoot, 'fake.mp4');
    await fs.writeFile(target, PNG);
    const source = asFileSource(target);
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: `![media](${source})` }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{ source, status: 'error' }]);
  });

  it('rejects an unsupported extension/kind with error, never a throw', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const target = path.join(fixture.approvedTempRoot, 'file.exe');
    await fs.writeFile(target, Buffer.from('MZ\x90\x00'));
    const source = asFileSource(target);
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: `![media](${source})` }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{ source, status: 'error' }]);
  });

  it('enforces authority for media sources (referenced outside → ready, unreferenced → error)', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const outsideTarget = path.join(fixture.root, 'outside.mp4');
    await fs.writeFile(outsideTarget, MP4);
    const outsideSource = asFileSource(outsideTarget);
    const unreferenced = path.join(fixture.approvedTempRoot, 'unreferenced.mp4');
    await fs.writeFile(unreferenced, MP4);
    const unreferencedSource = asFileSource(unreferenced);
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: `![outside](${outsideSource})` }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const response = await prepare(fixture.app, fixture.directory, [outsideSource, unreferencedSource]);

    expect(response.body.results).toEqual([
      // Always-relaxed (ADR-1): a referenced outside-workspace source is granted.
      expect.objectContaining({
        source: outsideSource,
        status: 'ready',
        outsideFileGrant: expect.any(String),
        expiresAt: expect.any(Number),
      }),
      { source: unreferencedSource, status: 'error' }, // not in markdownImageSources
    ]);
  });

  it('parity: grant-route caps and media MIME set match the renderer (Task 6)', async () => {
    // Renderer constants — imported statically from the UI package (Task 6).
    const { MARKDOWN_MEDIA_MAX_BYTES, SUPPORTED_MEDIA_MIME_TYPES } = await import(
      '@/components/chat/markdown/markdownImageAssets'
    );

    expect(GRANT_ROUTE_MEDIA_SIZE_CAPS).toEqual(MARKDOWN_MEDIA_MAX_BYTES);
    expect([...GRANT_ROUTE_MEDIA_MIME_TYPES].sort()).toEqual([...SUPPORTED_MEDIA_MIME_TYPES].sort());
  });
});

describe('markdown media any-path (always-relaxed, ADR-1)', () => {
  const asFileSource = (pathName) => new URL(`file://${pathName}`).toString();

  const writeOutsideSource = async (fixture, filename, bytes) => {
    const target = path.join(fixture.root, filename);
    await fs.writeFile(target, bytes);
    return { target, source: asFileSource(target) };
  };

  const referenceInMessage = (fixture, source) => {
    fixture.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      info: { id: 'msg_1', role: 'assistant' },
      parts: [{ type: 'text', text: `![media](${source})` }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
  };

  it('grants ready for an absolute source outside the workspace (always-relaxed, no env flag)', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const { target, source } = await writeOutsideSource(fixture, 'outside.png', PNG);
    referenceInMessage(fixture, source);

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{
      source,
      status: 'ready',
      path: await fs.realpath(target),
      outsideFileGrant: expect.any(String),
      expiresAt: expect.any(Number),
    }]);
  });

  it('rejects an oversized file (valid signature, size > per-kind cap) even when always-relaxed', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const PNG_HEADER = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(4)]);
    const oversized = Buffer.alloc(10 * MIB + 1);
    PNG_HEADER.copy(oversized, 0);
    const { source } = await writeOutsideSource(fixture, 'too-big.png', oversized);
    referenceInMessage(fixture, source);

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{ source, status: 'error' }]);
  });

  it('rejects a bad container signature (PNG bytes labeled .mp4) even when always-relaxed', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const { source } = await writeOutsideSource(fixture, 'fake.mp4', PNG);
    referenceInMessage(fixture, source);

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{ source, status: 'error' }]);
  });

  it('resolves a workspace symlink pointing outside via realpath and stays ready (always-relaxed)', async () => {
    const fixture = await createFixture({
      sources: ['linked.png'],
      markdown: 'no default source',
    });
    const { target } = await writeOutsideSource(fixture, 'outside.png', PNG);
    const linkPath = path.join(fixture.directory, 'linked.png');
    await fs.symlink(target, linkPath);
    const source = asFileSource(linkPath);
    referenceInMessage(fixture, source);

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{
      source,
      status: 'ready',
      path: path.resolve(linkPath),
    }]);
  });

  it('returns error for a symlink loop (ELOOP) even when always-relaxed', async () => {
    const fixture = await createFixture({
      sources: ['a.png'],
      markdown: 'no default source',
    });
    const linkA = path.join(fixture.directory, 'a.png');
    const linkB = path.join(fixture.directory, 'b.png');
    await fs.symlink('b.png', linkA);
    await fs.symlink('a.png', linkB);
    const source = asFileSource(linkA);
    referenceInMessage(fixture, source);

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{ source, status: 'error' }]);
  });

  it('rejects a file:// URL with a non-localhost host (always-relaxed)', async () => {
    const foreign = 'file://remotehost/etc/passwd.png';
    const fixture = await createFixture({
      sources: [foreign],
      markdown: `![media](${foreign})`,
    });

    const response = await prepare(fixture.app, fixture.directory, [foreign]);

    expect(response.body.results).toEqual([{ source: foreign, status: 'error' }]);
  });

  it('refuses an unreferenced source (not in markdownImageSources) even when always-relaxed', async () => {
    const fixture = await createFixture({ markdown: 'no default source' });
    const { source } = await writeOutsideSource(fixture, 'outside.png', PNG);

    const response = await prepare(fixture.app, fixture.directory, [source]);

    expect(response.body.results).toEqual([{ source, status: 'error' }]);
  });
});
