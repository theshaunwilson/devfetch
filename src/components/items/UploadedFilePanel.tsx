'use client';

import { FileText, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatFileSize } from '@/lib/uploads';
import type { UploadedFile } from '@/types/upload';

interface UploadedFilePanelProps {
  /** The upload that has landed. Null while the first one is still going up. */
  value: UploadedFile | null;
  /** A blob URL of the local file, shown for image types before it is stored. */
  preview: string | null;
  isImage: boolean;
  /** Percent complete, or null once the upload has finished. */
  progress: number | null;
  disabled?: boolean;
  onClear: () => void;
}

/**
 * The chosen-or-uploading half of `FileUpload`: thumbnail, name, size and
 * either a progress bar or a remove button.
 *
 * Split out because the empty drop target and this panel share nothing but
 * their container — the drop target stays inline as the component's resting
 * state.
 */
export function UploadedFilePanel({
  value,
  preview,
  isImage,
  progress,
  disabled,
  onClear,
}: UploadedFilePanelProps) {
  const uploading = progress !== null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        {preview && isImage ? (
          // Not `next/image`: the source is a blob URL of a file that has
          // not been stored yet, which the optimizer cannot fetch.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted/40">
            <FileText className="size-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={value?.fileName}>
            {value?.fileName ?? 'Uploading…'}
          </p>
          {value && (
            <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(value.fileSize)}</p>
          )}
          {uploading && (
            <div className="mt-2 flex items-center gap-2">
              <Progress value={progress} className="flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onClear}
          disabled={disabled}
          aria-label={uploading ? 'Cancel upload' : 'Remove file'}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
