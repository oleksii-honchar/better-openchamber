import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { FilePartMediaBody } from './filePartMedia';

// Branch-level test for the file-part media display in MessageFilesDisplay
// (non-compact mode). MessageFilesDisplay lives inside FileAttachment.tsx,
// which pulls in input-store/session-store/react-toastify/chart hooks that
// the unit runner cannot load in isolation, so the media-kind branch is
// asserted directly on the presentational body seam the component imports
// (mirroring MarkdownImageGallery.test.tsx → MarkdownMediaThumbnailBody).

const renderBody = (props: {
  kind: 'video' | 'audio';
  url: string;
  filename: string;
  size?: number;
  signatureValid?: boolean;
  unavailableLabel: string;
}): string =>
  renderToStaticMarkup(
    <FilePartMediaBody
      kind={props.kind}
      url={props.url}
      filename={props.filename}
      size={props.size}
      signatureValid={props.signatureValid}
      unavailableLabel={props.unavailableLabel}
    />,
  );

describe('MessageFilesDisplay file-part media branch', () => {
  test('renders a video/mp4 file part as a <video controls preload="metadata"> player', () => {
    const markup = renderBody({
      kind: 'video',
      url: 'https://assets.example/granted/clip.mp4',
      filename: 'clip.mp4',
      size: 1024 * 1024,
      signatureValid: true,
      unavailableLabel: 'Media is unavailable',
    });

    expect(markup).toContain('<video');
    expect(markup).toContain('controls=""');
    expect(markup).toContain('preload="metadata"');
    expect(markup).toContain('src="https://assets.example/granted/clip.mp4"');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('Media is unavailable');
  });

  test('renders an audio/mpeg file part as an <audio controls preload="metadata"> player', () => {
    const markup = renderBody({
      kind: 'audio',
      url: 'https://assets.example/granted/track.mp3',
      filename: 'track.mp3',
      size: 512 * 1024,
      signatureValid: true,
      unavailableLabel: 'Media is unavailable',
    });

    expect(markup).toContain('<audio');
    expect(markup).toContain('controls=""');
    expect(markup).toContain('preload="metadata"');
    expect(markup).toContain('src="https://assets.example/granted/track.mp3"');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('Media is unavailable');
  });

  test('renders a non-crashing fallback when a file-part video is missing', () => {
    const markup = renderBody({
      kind: 'video',
      url: '',
      filename: 'missing.mp4',
      size: 1024 * 1024,
      signatureValid: true,
      unavailableLabel: 'Media is unavailable',
    });

    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('Media is unavailable');
  });

  test('renders a non-crashing fallback when a file-part video exceeds the size cap', () => {
    const markup = renderBody({
      kind: 'video',
      url: 'https://assets.example/granted/huge.mp4',
      filename: 'huge.mp4',
      size: 1024 * 1024 * 1024,
      signatureValid: true,
      unavailableLabel: 'Media is unavailable',
    });

    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('Media is unavailable');
  });

  test('renders a non-crashing fallback for an unsupported file-part media signature', () => {
    const markup = renderBody({
      kind: 'video',
      url: 'https://assets.example/granted/fake.mp4',
      filename: 'fake.mp4',
      size: 1024 * 1024,
      signatureValid: false,
      unavailableLabel: 'Media is unavailable',
    });

    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('Media is unavailable');
  });
});