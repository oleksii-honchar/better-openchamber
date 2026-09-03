import { describe, expect, mock, test } from 'bun:test';

type SanitizeAttribute = {
  attrName: string;
  attrValue: string;
  forceKeepAttr?: boolean;
};

class TestAnchorElement {
  target = '';

  setAttribute(name: string, value: string): void {
    if (name === 'target') this.target = value;
  }
}

const sanitizeHooks: {
  uponSanitizeAttribute?: (node: unknown, data: SanitizeAttribute) => void;
  afterSanitizeAttributes?: (node: unknown) => void;
} = {};

Object.assign(globalThis, {
  window: {},
  HTMLAnchorElement: TestAnchorElement,
});

mock.module('dompurify', () => ({
  default: {
    isSupported: true,
    addHook: (name: keyof typeof sanitizeHooks, hook: never) => {
      sanitizeHooks[name] = hook;
    },
    sanitize: (html: string) => html.replace(/ href="([^"]*)"/g, (attribute, href: string) => {
      const anchor = new TestAnchorElement();
      const data: SanitizeAttribute = { attrName: 'href', attrValue: href };
      sanitizeHooks.uponSanitizeAttribute?.(anchor, data);
      sanitizeHooks.afterSanitizeAttributes?.(anchor);

      return data.forceKeepAttr || /^(?:https?|mailto|tel):/i.test(href) ? attribute : '';
    }),
  },
}));
mock.module('./markdown-worker', () => ({
  highlightCodeInWorker: async () => null,
}));

import { escapeRawMarkdownHtml, isLocalFileUrl, MARKDOWN_FORBIDDEN_TAGS } from './markdownSecurity';

const {
  __markdownImageCandidateCacheForTests,
  extractMarkdownImageCandidates,
  renderMarkdownSync,
} = await import('./markdownCore');
const { resolveMarkdownImageSource } = await import('./markdownImageAssets');

describe('markdown sanitization', () => {
  test('turns raw assistant HTML into inert visible text', () => {
    const payload = '<style>@import url("https://example.test/theme.css");</style>';

    expect(escapeRawMarkdownHtml(payload)).toBe(
      '&lt;style&gt;@import url(&quot;https://example.test/theme.css&quot;);&lt;/style&gt;',
    );
  });

  test('forbids script and stylesheet elements as active content', () => {
    expect(MARKDOWN_FORBIDDEN_TAGS).toContain('script');
    expect(MARKDOWN_FORBIDDEN_TAGS).toContain('style');
  });

  test('allows only local file URLs through the sanitizer policy', () => {
    expect(isLocalFileUrl('file:///private/tmp/report%20viewer.html')).toBe(true);
    expect(isLocalFileUrl('file://localhost/private/tmp/REPORT.md')).toBe(true);
    expect(isLocalFileUrl('file://remote-host/share/report.html')).toBe(false);
    expect(isLocalFileUrl('javascript:alert(1)')).toBe(false);
  });

  test('keeps app and local file links while stripping blocked schemes', () => {
    const html = renderMarkdownSync([
      '[app](obsidian://open?vault=Notebook)',
      '[file](file:///workspace/notes.md)',
      '[script](javascript:alert(1))',
      '[diagnostic](ms-msdt:/id%20PCWDiagnostic)',
    ].join('\n\n'), 'inline');

    expect(html).toContain('href="obsidian://open?vault=Notebook"');
    expect(html).toContain('href="file:///workspace/notes.md"');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).not.toContain('href="ms-msdt:/id%20PCWDiagnostic"');
  });

});

describe('Markdown images', () => {
  test('renders assistant images as icon-ready text without loading the source', () => {
    const html = renderMarkdownSync([
      '[linked image](packages/vscode/extension.jpg)',
      '![image syntax](packages/vscode/extension.jpg)',
    ].join('\n\n'), 'label');

    expect(html).toContain('data-openchamber-markdown-image-label="true"');
    expect(html).toContain('extension.jpg');
    expect(html).not.toContain('image syntax');
    expect(html).not.toContain('<img');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  test('keeps non-chat Markdown images inline', () => {
    const html = renderMarkdownSync([
      '[remote link](https://example.test/image.png)',
      '![remote image](https://example.test/image.png)',
    ].join('\n\n'));

    expect(html).toContain('<a href="https://example.test/image.png"');
    expect(html).toContain('<img src="https://example.test/image.png" alt="remote image">');
    expect(html).not.toContain('data-openchamber-markdown-image-label');
  });

  test('collects image syntax across mixed Markdown and ignores links and code', () => {
    const candidates = extractMarkdownImageCandidates([
      [
        'Before [local link](screens/first%20view.png) and `![code](ignored.png)`.',
        '',
        '- ![duplicate](screens/first%20view.png)',
        '- ![remote](https://example.test/second.webp?size=2)',
        '',
        '```md',
        '![fenced](ignored-too.jpg)',
        '```',
      ].join('\n'),
      'After ![third](data:image/png;base64,AAAA).',
    ]);

    expect(candidates).toEqual([
      { source: 'screens/first%20view.png', filename: 'first view.png', kind: 'image' },
      { source: 'https://example.test/second.webp?size=2', filename: 'second.webp', kind: 'image' },
      { source: 'data:image/png;base64,AAAA', filename: 'third', kind: 'image' },
    ]);
  });

  test('does not add an ordinary local image link to the gallery', () => {
    expect(extractMarkdownImageCandidates(['[download](screens/image.png)'])).toEqual([]);
  });

  test('limits one finalized message gallery to twelve unique candidates', () => {
    const markdown = Array.from({ length: 14 }, (_, index) => `![image ${index}](screens/${index}.png)`).join('\n');

    const candidates = extractMarkdownImageCandidates([markdown]);

    expect(candidates).toHaveLength(12);
    expect(candidates.at(-1)?.source).toBe('screens/11.png');
  });

  test('reuses extracted candidates across virtualized remounts without changing gallery behavior', () => {
    __markdownImageCandidateCacheForTests.reset();
    const contents = Array.from({ length: 20 }, (_, index) => `![image ${index}](screens/${index}.png)`);

    expect(extractMarkdownImageCandidates(contents)).toHaveLength(12);
    expect(__markdownImageCandidateCacheForTests.stats().scans).toBe(12);

    for (let round = 0; round < 1000; round += 1) {
      expect(extractMarkdownImageCandidates(contents)).toHaveLength(12);
    }

    const stats = __markdownImageCandidateCacheForTests.stats();
    expect(stats.entries).toBe(12);
    expect(stats.scans).toBe(12);
  });

  test('scans one thousand independent messages once across virtualized remounts', () => {
    __markdownImageCandidateCacheForTests.reset();
    const messages = Array.from(
      { length: 1000 },
      (_, index) => `![image ${index}](screens/${index}.png)`,
    );

    for (const message of messages) extractMarkdownImageCandidates([message]);
    for (const message of messages) extractMarkdownImageCandidates([message]);

    const stats = __markdownImageCandidateCacheForTests.stats();
    expect(stats.entries).toBe(1000);
    expect(stats.scans).toBe(1000);
  });

  test('gives embedded images without alt text a stable filename', () => {
    const source = 'data:image/png;base64,AAAA';

    expect(extractMarkdownImageCandidates([`![](${source})`])).toEqual([
      { source, filename: 'image.png', kind: 'image' },
    ]);
    expect(renderMarkdownSync(`![](${source})`, 'label')).toContain('image.png');
  });

  test('bounds cached candidate entries and bytes, and skips oversized individual content', () => {
    __markdownImageCandidateCacheForTests.reset();
    for (let index = 0; index < 1025; index += 1) {
      extractMarkdownImageCandidates([`![image ${index}](screens/${index}.png)`]);
    }
    const boundedStats = __markdownImageCandidateCacheForTests.stats();
    expect(boundedStats.entries).toBe(1024);
    expect(boundedStats.bytes <= 2 * 1024 * 1024).toBe(true);

    __markdownImageCandidateCacheForTests.reset();
    const oversized = `![image](screens/large.png)\n${'x'.repeat(64 * 1024)}`;

    extractMarkdownImageCandidates([oversized]);
    extractMarkdownImageCandidates([oversized]);
    expect(__markdownImageCandidateCacheForTests.stats()).toEqual({ entries: 0, bytes: 0, scans: 2 });
  });

  test('validates embedded image bytes against the declared MIME type', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const signal = new AbortController().signal;

    expect(await resolveMarkdownImageSource(`data:image/png;base64,${png}`, signal)).toBe(`data:image/png;base64,${png}`);
    await resolveMarkdownImageSource(`data:image/jpeg;base64,${png}`, signal).then(
      () => { throw new Error('Expected mismatched image data to fail'); },
      (error: unknown) => expect((error as Error).message).toBe('Unsupported image data'),
    );
  });

  test('does not resolve images after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await resolveMarkdownImageSource('https://example.test/image.png', controller.signal).then(
      () => { throw new Error('Expected an aborted image load to fail'); },
      (error: unknown) => expect((error as Error).name).toBe('AbortError'),
    );
  });

  test('keeps the existing image renderer outside finalized assistant text', () => {
    const html = renderMarkdownSync('![tool image](https://example.test/image.png)');

    expect(html).toContain('<img src="https://example.test/image.png"');
    expect(html).not.toContain('data-openchamber-markdown-image');
  });
});

describe('Markdown media candidates', () => {
  test('classifies image-syntax video and audio destinations by extension', () => {
    expect(extractMarkdownImageCandidates(['![label](video.mp4)'])).toEqual([
      { source: 'video.mp4', filename: 'video.mp4', kind: 'video' },
    ]);
    expect(extractMarkdownImageCandidates(['![label](audio.mp3)'])).toEqual([
      { source: 'audio.mp3', filename: 'audio.mp3', kind: 'audio' },
    ]);
  });

  test('keeps image-syntax png/jpg destinations classified as image', () => {
    expect(extractMarkdownImageCandidates(['![a](screens/a.png)', '![b](screens/b.jpg)'])).toEqual([
      { source: 'screens/a.png', filename: 'a.png', kind: 'image' },
      { source: 'screens/b.jpg', filename: 'b.jpg', kind: 'image' },
    ]);
  });

  test('classifies remote media destinations by extension', () => {
    expect(extractMarkdownImageCandidates(['![clip](https://example.test/clip.webm)'])).toEqual([
      { source: 'https://example.test/clip.webm', filename: 'clip.webm', kind: 'video' },
    ]);
    expect(extractMarkdownImageCandidates(['![track](https://example.test/track.wav?x=1)'])).toEqual([
      { source: 'https://example.test/track.wav?x=1', filename: 'track.wav', kind: 'audio' },
    ]);
  });

  test('captures raw media links whose text describes media', () => {
    expect(extractMarkdownImageCandidates(['[watch](video.mp4)'])).toEqual([
      { source: 'video.mp4', filename: 'video.mp4', kind: 'video' },
    ]);
    expect(extractMarkdownImageCandidates(['[listen](https://example.test/clip.mp3)'])).toEqual([
      { source: 'https://example.test/clip.mp3', filename: 'clip.mp3', kind: 'audio' },
    ]);
    expect(extractMarkdownImageCandidates(['[watch](https://example.test/clip.mp4?raw=1)'])).toEqual([
      { source: 'https://example.test/clip.mp4?raw=1', filename: 'clip.mp4', kind: 'video' },
    ]);
  });

  test('excludes links whose text does not describe media or whose destination is not media', () => {
    expect(extractMarkdownImageCandidates(['[download](video.mp4)'])).toEqual([]);
    expect(extractMarkdownImageCandidates(['[watch](https://example.test/article)'])).toEqual([]);
    expect(extractMarkdownImageCandidates(['[read](https://example.test/page.html)'])).toEqual([]);
  });

  test('keeps data URLs image-only and rejects media data URLs', () => {
    expect(extractMarkdownImageCandidates(['![x](data:video/mp4;base64,AAAA)'])).toEqual([]);
    expect(extractMarkdownImageCandidates(['![x](data:image/png;base64,AAAA)'])).toEqual([
      { source: 'data:image/png;base64,AAAA', filename: 'x', kind: 'image' },
    ]);
  });

  test('does not emit audio candidates for trimmed extensions (ogg/oga/aac/flac)', () => {
    // These extensions were classified `audio` but have no MIME-set entry or
    // signature support — the classifier no longer promises media for them
    // (reviewer Issue #2; trimmed from LOCAL_MEDIA_EXTENSION_RE + kind map).
    for (const extension of ['ogg', 'oga', 'aac', 'flac']) {
      expect(extractMarkdownImageCandidates([`![label](track.${extension})`])).toEqual([]);
      expect(extractMarkdownImageCandidates([`[listen](https://example.test/track.${extension})`])).toEqual([]);
    }
    // Supported audio types are unchanged.
    expect(extractMarkdownImageCandidates(['![label](audio.mp3)'])).toEqual([
      { source: 'audio.mp3', filename: 'audio.mp3', kind: 'audio' },
    ]);
  });

  test('dedupes media candidates by source across image and link forms', () => {
    expect(extractMarkdownImageCandidates([
      '![a](video.mp4) [watch](video.mp4) ![b](video.mp4)',
    ])).toEqual([
      { source: 'video.mp4', filename: 'video.mp4', kind: 'video' },
    ]);
  });

  test('caps combined media candidates at twelve across kinds', () => {
    const markdown = [
      ...Array.from({ length: 6 }, (_, index) => `![image ${index}](screens/${index}.png)`),
      ...Array.from({ length: 6 }, (_, index) => `![video ${index}](clips/${index}.mp4)`),
      ...Array.from({ length: 6 }, (_, index) => `![audio ${index}](audio/${index}.mp3)`),
    ].join('\n');

    const candidates = extractMarkdownImageCandidates([markdown]);

    expect(candidates).toHaveLength(12);
    expect(candidates.at(-1)?.kind).toBe('video');
    expect(candidates.at(-1)?.source).toBe('clips/5.mp4');
  });

  test('keeps cache instrumentation semantics with media candidates', () => {
    __markdownImageCandidateCacheForTests.reset();
    const content = '![watch](video.mp4)\n![listen](audio.mp3)';

    expect(extractMarkdownImageCandidates([content])).toHaveLength(2);
    expect(__markdownImageCandidateCacheForTests.stats().scans).toBe(1);

    for (let round = 0; round < 10; round += 1) {
      expect(extractMarkdownImageCandidates([content])).toHaveLength(2);
    }

    const stats = __markdownImageCandidateCacheForTests.stats();
    expect(stats.entries).toBe(1);
    expect(stats.scans).toBe(1);
  });
});
