'use client';

import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  formatFileSize,
  isImageUploadType,
  uploadConstraintsFor,
  validateUpload,
} from '@/lib/uploads';
import { UploadedFilePanel } from '@/components/items/UploadedFilePanel';
import { uploadFile } from '@/lib/upload-request';
import { cn } from '@/lib/utils';
import type { UploadedFile } from '@/types/upload';

interface FileUploadProps {
  /** The item type's slug — decides the size limit and the accepted extensions. */
  slug: string;
  /** The upload that has already landed, if any. */
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * The file picker behind File and Image items: drop a file on it, or click to
 * browse.
 *
 * The upload happens as soon as a file is chosen rather than when the item is
 * saved, so the create form only ever hands `createItem` a key that already
 * names a stored object. The cost is that abandoning the dialog after an upload
 * leaves that object behind — see the feature notes.
 */
export function FileUpload({ slug, value, onChange, disabled, ariaLabel }: FileUploadProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeUpload = useRef<{ abort: () => void } | null>(null);

  const constraints = uploadConstraintsFor(slug);
  const isImage = isImageUploadType(slug);
  const uploading = progress !== null;

  // The preview shows the local file rather than fetching the stored object
  // back: there is no item yet, so there is no `/api/files/[id]` to point at.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // An upload in flight when the dialog closes is abandoned rather than left to
  // finish against a form that no longer exists.
  useEffect(() => {
    return () => activeUpload.current?.abort();
  }, []);

  if (!constraints) return null;

  function replacePreview(next: string | null) {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);

      return next;
    });
  }

  async function handleFile(file: File) {
    setError(null);

    // Checked here as well as on the server, so an oversized or unaccepted file
    // is refused before a megabyte goes over the wire. The server's copy is
    // still the one that decides.
    const check = validateUpload({
      slug,
      fileName: file.name,
      reportedType: file.type,
      size: file.size,
    });

    if (!check.ok) {
      setError(check.error);

      return;
    }

    activeUpload.current?.abort();
    onChange(null);
    replacePreview(isImage ? URL.createObjectURL(file) : null);
    setProgress(0);

    const task = uploadFile(file, slug, setProgress);
    activeUpload.current = task;

    const result = await task.promise;

    // A newer file was picked while this one was in flight; that upload owns
    // the component now.
    if (activeUpload.current !== task) return;

    activeUpload.current = null;
    setProgress(null);

    if (!result.success) {
      replacePreview(null);
      // Blank is an abort, which the user caused on purpose.
      if (result.error) setError(result.error);

      return;
    }

    onChange(result.data);
  }

  function handleClear() {
    activeUpload.current?.abort();
    activeUpload.current = null;
    setProgress(null);
    setError(null);
    replacePreview(null);
    onChange(null);

    // Without this the same file cannot be picked again, since the input's
    // value would not change.
    if (inputRef.current) inputRef.current.value = '';
  }

  const chosen = value !== null;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={constraints.accept}
        className="sr-only"
        disabled={disabled}
        aria-label={ariaLabel ?? 'File'}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) void handleFile(file);
        }}
      />

      {chosen || uploading ? (
        <UploadedFilePanel
          value={value}
          preview={preview}
          isImage={isImage}
          progress={progress}
          disabled={disabled}
          onClear={handleClear}
        />
      ) : (
        // A button rather than a label wrapping the input: this is the drop
        // target too, and a button gets keyboard activation for free.
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);

            const file = event.dataTransfer.files?.[0];

            if (file) void handleFile(file);
          }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
            'hover:border-muted-foreground/50 hover:bg-muted/40',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
            dragging && 'border-primary bg-primary/5',
          )}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            Drop {isImage ? 'an image' : 'a file'} here, or click to browse
          </span>
          <span className="text-xs break-all text-muted-foreground">
            {constraints.extensions.join(', ')} — up to {formatFileSize(constraints.maxSize)}
          </span>
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
