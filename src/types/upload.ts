/**
 * What `POST /api/uploads` returns.
 *
 * The key rather than a URL: objects are private, so what comes back is the
 * name the object was stored under, which the create form then hands to
 * `createItem` as `fileUrl`. Reading it back goes through `/api/files/[id]`.
 */
export interface UploadedFile {
  key: string;
  /** The uploader's own filename, kept for display and for the download name. */
  fileName: string;
  fileSize: number;
  /** Ours, derived from the extension — not what the browser claimed. */
  contentType: string;
}

export type UploadResponse =
  | { success: true; data: UploadedFile }
  | { success: false; error: string };
