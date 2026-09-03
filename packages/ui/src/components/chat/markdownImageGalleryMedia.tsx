import React from 'react';

import { Icon } from '@/components/icon/Icon';

import type { MarkdownImageCandidate } from './markdown/markdownCore';

const mediaKindIcon = (kind: MarkdownImageCandidate['kind']): 'file-image' | 'file-video' | 'file-music' => (
  kind === 'video' ? 'file-video' : kind === 'audio' ? 'file-music' : 'file-image'
);

export type MarkdownMediaThumbnailImage = {
  url: string;
  status: 'loading' | 'ready' | 'error';
};

/**
 * Presentational thumbnail media box + caption. Renders the native element
 * for the candidate's kind once an asset URL is available, the existing icon
 * fallback when an image cannot load, and a non-crashing icon + label fallback
 * for unsupported/missing video or audio. No hooks — labels arrive translated.
 */
export const MarkdownMediaThumbnailBody: React.FC<{
  image: MarkdownMediaThumbnailImage;
  candidate: MarkdownImageCandidate;
  onImageLoad: () => void;
  onImageError: () => void;
  unavailableLabel: string;
}> = ({ image, candidate, onImageLoad, onImageError, unavailableLabel }) => {
  const kind = candidate.kind;
  const failed = image.status === 'error';
  const canShowMedia = image.url && image.status !== 'error';

  return (
    <>
      <span className="flex h-[72px] w-[100px] items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-muted/10">
        {!canShowMedia ? (
          failed && kind !== 'image' ? (
            <span
              className="flex flex-col items-center gap-0.5 px-1 text-center text-muted-foreground"
              title={unavailableLabel}
            >
              <Icon name={mediaKindIcon(kind)} className="h-5 w-5 shrink-0" />
              <span className="truncate typography-meta">{unavailableLabel}</span>
            </span>
          ) : (
            <Icon name={mediaKindIcon(kind)} className="h-5 w-5 text-muted-foreground" />
          )
        ) : kind === 'image' ? (
          <img
            src={image.url}
            alt={candidate.filename}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={onImageLoad}
            onError={onImageError}
            data-openchamber-markdown-image="true"
            data-openchamber-markdown-image-thumbnail="true"
            data-openchamber-markdown-image-state={image.status}
          />
        ) : kind === 'video' ? (
          <video
            src={image.url}
            className="h-full w-full object-contain"
            controls
            preload="metadata"
            onError={onImageError}
            data-openchamber-markdown-image-media="true"
            data-openchamber-markdown-image-state={image.status}
          />
        ) : (
          <audio
            src={image.url}
            className="w-[92px]"
            controls
            preload="metadata"
            onError={onImageError}
            data-openchamber-markdown-image-media="true"
            data-openchamber-markdown-image-state={image.status}
          />
        )}
      </span>
      <span
        className="mt-1 flex w-[100px] items-center justify-center gap-1 text-muted-foreground"
        title={candidate.filename}
        data-openchamber-markdown-image-caption="true"
      >
        <Icon name={mediaKindIcon(kind)} className="h-3 w-3 shrink-0" />
        <span className="min-w-0 truncate typography-meta">{candidate.filename}</span>
      </span>
    </>
  );
};
