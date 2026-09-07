import { getItemFile } from '@/lib/db/items';
import { getObjectStream } from '@/lib/r2';
import { contentTypeFor } from '@/lib/uploads';

/**
 * Serves the file behind one item, from this app's own origin.
 *
 * This is what makes uploads private: the bucket is never read directly, so an
 * object is only reachable through an item the signed-in user owns —
 * `getItemFile` scopes its lookup to them, and an unknown id, somebody else's
 * id and an item with no file are all a 404. Doing its own auth check for the
 * same reason `/api/items/[id]` does: `src/proxy.ts` does not match `/api` and
 * would answer with a redirect.
 *
 * Serving from our origin also avoids the CORS the bucket's own domain would
 * need, and lets `?download=1` set the filename the browser saves under.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<'/api/files/[id]'>,
): Promise<Response> {
  const { id } = await params;

  try {
    const file = await getItemFile(id);

    if (!file) {
      // Not signed in reads the same as not found: the 404 already covers an
      // item that is not this user's, and a 401 here would only confirm that
      // some item has this id.
      return new Response('Not found', { status: 404 });
    }

    // Derived from the extension, never stored from the browser's claim, so an
    // object cannot be served as a media type it was not accepted as.
    const contentType = contentTypeFor(file.typeSlug, file.fileName) ?? 'application/octet-stream';

    const body = await getObjectStream(file.key);

    if (!body) {
      console.error('Item %s names an object that is not in the bucket', id);

      return new Response('Not found', { status: 404 });
    }

    const download = new URL(request.url).searchParams.has('download');

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        // Stops a browser second-guessing the media type above — without it a
        // text file whose first bytes look like markup can be sniffed as HTML.
        'X-Content-Type-Options': 'nosniff',
        // An SVG is a document, and this route is same-origin, so one opened
        // directly could otherwise run script against the app. Serving every
        // object under a policy that permits nothing closes that without
        // affecting <img>, which never runs an SVG's script anyway.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        // The object at a key never changes — a replaced file gets a new key —
        // but it is private, so only the browser that fetched it may keep it.
        'Cache-Control': 'private, max-age=3600',
        ...(file.fileSize ? { 'Content-Length': String(file.fileSize) } : {}),
      },
    });
  } catch (error) {
    console.error('Could not serve the file for item %s:', id, error);

    return new Response('Could not load the file', { status: 500 });
  }
}
