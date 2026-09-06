import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { MarkdownImageCandidate } from './markdown/markdownCore';
import { MarkdownMediaThumbnailBody } from './markdownImageGalleryMedia';

// Branch-level gallery test: the full gallery render path pulls markdownCore →
// markdown-worker → a Vite `?worker&url` asset import that unit runners cannot
// load, so the media-kind branch is asserted directly on the presentational
// body component (the element tree it produces for a prepared media candidate).

const aCandidate = (kind: MarkdownImageCandidate['kind'], source: string, filename: string): MarkdownImageCandidate => ({
  source,
  filename,
  kind,
});

const renderBody = (candidate: MarkdownImageCandidate, image: { url: string; status: 'loading' | 'ready' | 'error' }): string =>
  renderToStaticMarkup(
    <MarkdownMediaThumbnailBody
      image={image}
      candidate={candidate}
      onImageLoad={() => undefined}
      onImageError={() => undefined}
      unavailableLabel="Media is unavailable"
    />,
  );

describe('MarkdownImageGallery media-kind branch', () => {
  test('renders a video candidate as a <video controls preload="metadata"> player', () => {
    const markup = renderBody(aCandidate('video', 'clip.mp4', 'clip.mp4'), {
      url: 'https://assets.example/granted/clip.mp4',
      status: 'loading',
    });

    expect(markup).toContain('<video');
    expect(markup).toContain('controls=""');
    expect(markup).toContain('preload="metadata"');
    expect(markup).toContain('src="https://assets.example/granted/clip.mp4"');
    expect(markup).not.toContain('<img');
  });

  test('renders an audio candidate as an <audio controls preload="metadata"> player', () => {
    const markup = renderBody(aCandidate('audio', 'track.mp3', 'track.mp3'), {
      url: 'https://assets.example/granted/track.mp3',
      status: 'loading',
    });

    expect(markup).toContain('<audio');
    expect(markup).toContain('controls=""');
    expect(markup).toContain('preload="metadata"');
    expect(markup).toContain('src="https://assets.example/granted/track.mp3"');
    expect(markup).not.toContain('<img');
  });

  test('keeps an image candidate on the existing <img> thumbnail path', () => {
    const markup = renderBody(aCandidate('image', 'photo.png', 'photo.png'), {
      url: 'https://assets.example/granted/photo.png',
      status: 'loading',
    });

    expect(markup).toContain('<img');
    expect(markup).toContain('loading="lazy"');
    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('<audio');
  });

  test('renders a non-crashing icon + label fallback when video is unavailable or unsupported', () => {
    const markup = renderBody(aCandidate('video', 'broken.mp4', 'broken.mp4'), {
      url: '',
      status: 'error',
    });

    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('Media is unavailable');
  });

  test('keeps a neutral media icon before a video has loaded (no failure label)', () => {
    const markup = renderBody(aCandidate('video', 'pending.mp4', 'pending.mp4'), {
      url: '',
      status: 'loading',
    });

    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('Media is unavailable');
  });

  test('renders a non-crashing icon + label fallback when an audio load fails', () => {
    const markup = renderBody(aCandidate('audio', 'broken.mp3', 'broken.mp3'), {
      url: '',
      status: 'error',
    });

    expect(markup).not.toContain('<audio');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('Media is unavailable');
  });

  test('VS Code gallery routes local candidates through the grants flow, not the workspace-only resolver', () => {
    // RED (ad-hoc Task 6): the VS Code branch must not call
    // `resolveWorkspaceMarkdownImageSource` for local candidates - it must use
    // `prepareLocalMarkdownImages` + `getPreparedMarkdownImageUrl` so outside-
    // workspace absolute paths receive a grant and render instead of failing
    // silently with "preview not available".
    //
    // The full gallery render path pulls markdownCore -> markdown-worker -> a
    // Vite `?worker&url` asset that unit runners cannot load, so the contract
    // is asserted as an import/source audit plus a behavior probe:
    //   1. MarkdownImageGallery must not import the workspace-only resolver.
    //   2. A grants-route result with `outsideFileGrant` must yield a URL with
    //      `allowOutsideWorkspace=true` (observed behavior, same as the asset
    //      tests above).
    // The drive-to-green equivalence completes in GREEN, where the gallery's
    // VS Code branch stops calling `resolveWorkspaceMarkdownImageSource`.
    const gallerySource = readFileSync(
      join(__dirname, 'MarkdownImageGallery.tsx'),
      'utf8',
    );

    expect(gallerySource.includes('resolveWorkspaceMarkdownImageSource')).toBe(false);
  });

  test('VS Code gallery loads prepared local assets via runtimeFetch (data URL), never a raw http asset URL', () => {
    // RED (Task 6 follow-up): in the VS Code webview a native `<img>` cannot
    // load a raw `/api/fs/raw` http URL — the image loader bypasses
    // `window.fetch`, so the request would hit the OpenCode server (no such
    // route) and fail silently with "preview not available". The gallery must
    // resolve prepared assets through `resolvePreparedMarkdownImageSource`
    // (which fetches via the bridge and materializes a data URL), not set the
    // raw `getPreparedMarkdownImageUrl` as `<img src>`.
    const gallerySource = readFileSync(
      join(__dirname, 'MarkdownImageGallery.tsx'),
      'utf8',
    );

    expect(gallerySource.includes('getPreparedMarkdownImageUrl(preparation, directory)')).toBe(false);
    expect(gallerySource.includes('resolvePreparedMarkdownImageSource')).toBe(true);
  });
});
