import type { UploadResponse } from '@/types/upload';

/**
 * Sends one file to `POST /api/uploads` and reports its progress.
 *
 * `XMLHttpRequest` rather than `fetch`, which has no upload progress event at
 * all — a request body cannot be observed as it goes out, only as it comes
 * back. This is the one place in the app that still needs XHR.
 *
 * Every failure resolves rather than rejects, carrying its own message, so the
 * caller has one shape to handle. An abort resolves with an empty message,
 * because the caller caused it — replacing or cancelling the file — and there
 * is nothing to report.
 */
export function uploadFile(
  file: File,
  slug: string,
  onProgress: (percent: number) => void,
): { promise: Promise<UploadResponse>; abort: () => void } {
  const request = new XMLHttpRequest();

  const promise = new Promise<UploadResponse>((resolve) => {
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      try {
        resolve(JSON.parse(request.responseText) as UploadResponse);
      } catch {
        // A non-JSON body means the request never reached the route — a proxy
        // error page, say — so the status is all there is to go on.
        resolve({ success: false, error: 'Could not upload this file. Please try again.' });
      }
    });

    request.addEventListener('error', () => {
      resolve({ success: false, error: 'Could not reach the server. Check your connection.' });
    });

    // Aborting is the caller replacing or cancelling the file; nothing to say.
    request.addEventListener('abort', () => {
      resolve({ success: false, error: '' });
    });

    const form = new FormData();
    form.append('file', file);
    form.append('slug', slug);

    request.open('POST', '/api/uploads');
    request.send(form);
  });

  return { promise, abort: () => request.abort() };
}