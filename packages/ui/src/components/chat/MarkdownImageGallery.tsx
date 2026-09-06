import React from 'react';
import { toast } from 'sonner';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import { useI18n } from '@/lib/i18n';
import {
  acquireRuntimeUrlAuthToken,
  refreshRuntimeUrlAuthToken,
  subscribeRuntimeUrlAuthToken,
} from '@/lib/runtime-auth';
import { getRuntimeApiBaseUrl } from '@/lib/runtime-switch';
import { MarkdownMediaThumbnailBody } from './markdownImageGalleryMedia';
import type { ToolPopupContent } from './message/types';
import {
  extractMarkdownImageCandidates,
  MAX_MARKDOWN_IMAGE_COUNT,
  type MarkdownImageCandidate,
} from './markdown/markdownCore';
import {
  getPreparedMarkdownImageUrl,
  isLocalMarkdownImageSource,
  prepareLocalMarkdownImages,
  resolveMarkdownImageSource,
  resolvePreparedMarkdownImageSource,
  type PreparedMarkdownImage,
} from './markdown/markdownImageAssets';

const useAssetAuth = (enabled: boolean): { ready: boolean; nonce: number } => {
  const [ready, setReady] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const apiBaseUrl = getRuntimeApiBaseUrl();

  React.useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const release = acquireRuntimeUrlAuthToken(apiBaseUrl);
    const unsubscribe = subscribeRuntimeUrlAuthToken(() => {
      if (!cancelled) setNonce((current) => current + 1);
    });
    const refresh = () => {
      void refreshRuntimeUrlAuthToken(apiBaseUrl)
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          if (!cancelled) retryTimer = setTimeout(refresh, 1000);
        });
    };
    refresh();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      release();
      unsubscribe();
    };
  }, [apiBaseUrl, enabled]);

  return { ready: !enabled || ready, nonce };
};

const MarkdownImageThumbnail: React.FC<{
  candidate: MarkdownImageCandidate;
  preparation?: PreparedMarkdownImage;
  directory: string;
  assetAuthReady: boolean;
  assetAuthNonce: number;
  onShowPopup?: (content: ToolPopupContent) => void;
}> = ({
  candidate,
  preparation,
  directory,
  assetAuthReady,
  assetAuthNonce,
  onShowPopup,
}) => {
  const { t } = useI18n();
  const thumbnailRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [shouldLoad, setShouldLoad] = React.useState(false);
  const [image, setImage] = React.useState<{ url: string; status: 'loading' | 'ready' | 'error' }>({
    url: '',
    status: 'loading',
  });
  const local = isLocalMarkdownImageSource(candidate.source);

  React.useEffect(() => {
    const thumbnail = (thumbnailRef.current ?? buttonRef.current);
    if (!thumbnail || shouldLoad) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShouldLoad(true);
      observer.disconnect();
    }, { rootMargin: '200px' });
    observer.observe(thumbnail);
    return () => observer.disconnect();
  }, [shouldLoad]);

React.useEffect(() => {
    // Local candidates always go through the grants-preparation flow
    // (`prepareLocalMarkdownImages`), in every runtime including VS Code, so
    // outside-workspace absolute paths receive a path-bound grant and render
    // instead of failing silently.
    //
    // The prepared asset is fetched through `runtimeFetch` (the VS Code
    // webview's native `<img>` cannot load a raw http asset URL — it bypasses
    // `window.fetch`, so a direct `/api/fs/raw` URL would hit the OpenCode server,
    // which has no such route). `resolvePreparedMarkdownImageSource` materializes
    // a data: URL through the bridge for every runtime.
    if (!shouldLoad || (local && !preparation)) return;
    if (local) {
      if (preparation?.status !== 'ready') {
        setImage({ url: '', status: 'error' });
        return;
      }
      if (!assetAuthReady) return;
      const controller = new AbortController();
      setImage({ url: '', status: 'loading' });
      void resolvePreparedMarkdownImageSource(preparation, directory, controller.signal)
        .then((url) => {
          if (controller.signal.aborted) return;
          setImage({ url, status: 'loading' });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setImage({ url: '', status: 'error' });
        });
      return () => controller.abort();
    }
    const controller = new AbortController();
    setImage({ url: '', status: 'loading' });
    void resolveMarkdownImageSource(candidate.source, controller.signal).then((url) => {
      if (controller.signal.aborted) return;
      setImage({ url, status: 'loading' });
    }).catch(() => {
      if (controller.signal.aborted) return;
      setImage({ url: '', status: 'error' });
    });
    return () => controller.abort();
  }, [assetAuthNonce, assetAuthReady, candidate.source, directory, local, preparation, shouldLoad]);

  const openPreview = React.useCallback(() => {
    if (image.status === 'error') {
      toast.error(t('filesView.error.previewUnavailable'));
      return;
    }
    if (image.status !== 'ready' || !onShowPopup) return;
    onShowPopup({
      open: true,
      title: candidate.filename,
      content: '',
      metadata: { tool: 'markdown-image-preview', filename: candidate.filename },
      image: { url: image.url, filename: candidate.filename },
    });
  }, [candidate.filename, image, onShowPopup, t]);

  const sharedClassName = 'w-[100px] shrink-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--interactive-focus-ring)]';
  const sharedDataAttributes = {
    'data-openchamber-markdown-image-action': 'true',
    'data-openchamber-markdown-image-source': candidate.source,
    'data-openchamber-markdown-image-filename': candidate.filename,
  };
  const mediaBody = (
    <MarkdownMediaThumbnailBody
      image={image}
      candidate={candidate}
      onImageLoad={() => setImage((current) => ({ ...current, status: 'ready' }))}
      onImageError={() => setImage({ url: '', status: 'error' })}
      unavailableLabel={t('chat.media.unavailable')}
    />
  );

  if (candidate.kind !== 'image') {
    // Video/audio play inline through the native controls; there is no popup
    // preview, so the gallery frame is a plain box (not the image preview
    // button). The action/source/filename data attributes are preserved.
    return (
      <div
        ref={thumbnailRef}
        className={sharedClassName}
        aria-label={candidate.filename}
        {...sharedDataAttributes}
      >
        {mediaBody}
      </div>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={sharedClassName}
      aria-label={candidate.filename}
      disabled={image.status === 'loading'}
      onClick={openPreview}
      {...sharedDataAttributes}
    >
      {mediaBody}
    </button>
  );
};

export const MarkdownImageGallery: React.FC<{
  sessionId?: string;
  messageId: string;
  contents: readonly string[];
  onShowPopup?: (content: ToolPopupContent) => void;
}> = ({ sessionId, messageId, contents, onShowPopup }) => {
  const directory = useEffectiveDirectory() ?? '';
  const galleryRef = React.useRef<HTMLDivElement>(null);
  const [shouldPrepare, setShouldPrepare] = React.useState(false);
  const [prepared, setPrepared] = React.useState<Map<string, PreparedMarkdownImage> | null>(null);
  const [prepareEpoch, setPrepareEpoch] = React.useState(0);
  const candidates = React.useMemo(
    () => extractMarkdownImageCandidates(contents, MAX_MARKDOWN_IMAGE_COUNT),
    [contents],
  );
  const serverPreparationSources = React.useMemo(
    () => candidates
      .filter((candidate) => isLocalMarkdownImageSource(candidate.source))
      .map((candidate) => candidate.source),
    [candidates],
  );
  React.useEffect(() => {
    if (serverPreparationSources.length === 0 || shouldPrepare) return;
    const gallery = galleryRef.current;
    if (!gallery || typeof IntersectionObserver === 'undefined') {
      setShouldPrepare(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShouldPrepare(true);
      observer.disconnect();
    }, { rootMargin: '200px' });
    observer.observe(gallery);
    return () => observer.disconnect();
  }, [serverPreparationSources.length, shouldPrepare]);

  React.useEffect(() => {
    if (!shouldPrepare || !sessionId || serverPreparationSources.length === 0) return;
    const controller = new AbortController();
    void prepareLocalMarkdownImages({
      sources: serverPreparationSources,
      directory,
      sessionId,
      messageId,
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      setPrepared(result);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setPrepared(new Map(serverPreparationSources.map((source) => [source, { status: 'error' }])));
      }
    });
    return () => controller.abort();
  }, [directory, messageId, prepareEpoch, serverPreparationSources, sessionId, shouldPrepare]);

  React.useEffect(() => {
    const nextExpiry = Math.min(...[...(prepared?.values() ?? [])]
      .filter((value): value is Extract<PreparedMarkdownImage, { status: 'ready' }> => value.status === 'ready')
      .map((value) => value.expiresAt ?? Number.POSITIVE_INFINITY));
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => setPrepareEpoch((current) => current + 1), Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [prepared]);

  const visibleCandidates = candidates.filter((candidate) => prepared?.get(candidate.source)?.status !== 'missing');
  const hasPreparedAssets = [...(prepared?.values() ?? [])].some((value) => value.status === 'ready');
  const assetAuth = useAssetAuth(hasPreparedAssets);
  if (visibleCandidates.length === 0) return null;

  return (
    <div
      ref={galleryRef}
      className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1"
      data-openchamber-markdown-image-gallery="true"
    >
      {visibleCandidates.map((candidate) => (
        <MarkdownImageThumbnail
          key={candidate.source}
          candidate={candidate}
          preparation={prepared?.get(candidate.source)}
          directory={directory}
          assetAuthReady={assetAuth.ready}
          assetAuthNonce={assetAuth.nonce}
          onShowPopup={onShowPopup}
        />
      ))}
    </div>
  );
};
