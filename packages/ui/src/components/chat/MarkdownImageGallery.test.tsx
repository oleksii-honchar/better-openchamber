import { describe, expect, test } from 'bun:test';
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
});
