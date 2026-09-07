'use client';

import { Download, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatFileSize, isImageUploadType } from '@/lib/uploads';
import type { ItemDetail } from '@/types/item';

interface ItemFilePanelProps {
  item: ItemDetail;
}

/**
 * The stored file behind a File or Image item: a preview for images, a card
 * naming the file for everything else, and a download either way.
 *
 * Both the preview and the download go through `/api/files/[id]` rather than at
 * the bucket. That is what keeps uploads private — the route serves the object
 * only to the user who owns the item — and it is the same-origin request the
 * spec's download proxy asks for, so no CORS is involved and the saved filename
 * is ours to set.
 */
export function ItemFilePanel({ item }: ItemFilePanelProps) {
  if (!item.fileUrl || !item.fileName) return null;

  const source = `/api/files/${item.id}`;
  const isImage = isImageUploadType(item.type.slug);

  return (
    <div className="flex flex-col gap-3">
      {isImage && (
        // Not `next/image`: the optimizer would have to fetch the object
        // itself, and it has no session to be allowed to.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={item.title}
          className="max-h-80 w-full rounded-lg border bg-muted/40 object-contain"
        />
      )}

      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <FileText className="size-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Titled as well as truncated: a long name is cut to fit, and
              hovering is then the only way to read the rest of it. */}
          <p className="truncate text-sm font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          {item.fileSize !== null && (
            <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</p>
          )}
        </div>

        <Button asChild variant="outline" size="sm" className="shrink-0">
          {/* `?download` makes the route answer with an attachment
              disposition, which is what names the saved file. */}
          <a href={`${source}?download`} download={item.fileName}>
            <Download className="size-4" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}
