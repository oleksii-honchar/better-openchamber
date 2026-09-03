import React from 'react';

import { Icon } from '@/components/icon/Icon';

import { MARKDOWN_MEDIA_MAX_BYTES } from './markdown/markdownImageAssets';

export type FilePartMediaKind = 'video' | 'audio';

const mediaKindIcon = (kind: FilePartMediaKind): 'file-video' | 'file-music' => (
  kind === 'video' ? 'file-video' : 'file-music'
);

const isUnderSizeCap = (kind: FilePartMediaKind, size?: number): boolean => (
  typeof size !== 'number' || !Number.isFinite(size) || size <= MARKDOWN_MEDIA_MAX_BYTES[kind]
);

/**
 * Presentational body for a file-part video/audio media tile in
 * `MessageFilesDisplay` (non-compact mode). Renders the native player once a
 * source URL is available and the file passes the established media guards
 * (missing source, over size cap, or unsupported signature → non-crashing icon
 * + label fallback). No hooks — labels arrive translated.
 */
export const FilePartMediaBody: React.FC<{
  kind: FilePartMediaKind;
  url: string;
  filename: string;
  size?: number;
  signatureValid?: boolean;
  unavailableLabel: string;
}> = ({ kind, url, filename, size, signatureValid, unavailableLabel }) => {
  const failed = !url || !isUnderSizeCap(kind, size) || signatureValid === false;
  const canShowMedia = url && !failed;

  return (
    <div className="relative rounded-lg border border-border/40 bg-muted/10 overflow-hidden group">
      {!canShowMedia ? (
        <div className="flex flex-col items-center justify-center gap-1 p-4 text-center text-muted-foreground">
          <Icon name={mediaKindIcon(kind)} className="h-5 w-5 shrink-0" />
          <span className="typography-meta truncate" title={unavailableLabel}>{unavailableLabel}</span>
        </div>
      ) : kind === 'video' ? (
        <video
          src={url}
          className="h-full w-full object-contain"
          controls
          preload="metadata"
          data-openchamber-file-part-media="true"
        />
      ) : (
        <audio
          src={url}
          className="w-full"
          controls
          preload="metadata"
          data-openchamber-file-part-media="true"
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-xs font-medium truncate">{filename}</p>
      </div>
    </div>
  );
};