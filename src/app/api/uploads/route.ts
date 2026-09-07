import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/db/user';
import { putObject } from '@/lib/r2';
import { MAX_UPLOAD_SIZE, buildObjectKey, extensionOf, validateUpload } from '@/lib/uploads';
import type { UploadResponse } from '@/types/upload';

function fail(error: string, status: number): NextResponse<UploadResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Stores one uploaded file and returns the key the item should point at.
 *
 * A route rather than a server action for two reasons. `src/proxy.ts`
 * deliberately does not match `/api`, so this does its own auth check — the
 * proxy answers with a redirect to the sign-in page, which a fetch would try
 * to parse as JSON. And a server action's body is capped at 1 MB by default,
 * well under the 10 MB the table allows, while a route handler takes the body
 * as it comes.
 *
 * Nothing the client sends is trusted with anything: the owner comes from the
 * session, the stored media type is derived from the extension rather than
 * taken from the browser's claim, and the key is minted here so it cannot name
 * somebody else's object.
 */
export async function POST(request: Request): Promise<NextResponse<UploadResponse>> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return fail('Not signed in', 401);
  }

  // Checked before the body is read: `formData()` buffers the whole request,
  // so an oversized upload would otherwise be held in memory in full only to
  // be refused afterwards. A missing header is left to the size check below.
  const declared = Number(request.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > MAX_UPLOAD_SIZE * 1.05) {
    return fail('That file is too large. The limit is 10 MB.', 413);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return fail('Could not read the upload.', 400);
  }

  const file = form.get('file');
  const slug = form.get('slug');

  if (!(file instanceof File) || typeof slug !== 'string') {
    return fail('Choose a file to upload.', 400);
  }

  const check = validateUpload({
    slug,
    fileName: file.name,
    reportedType: file.type,
    size: file.size,
  });

  if (!check.ok) {
    return fail(check.error, 400);
  }

  try {
    const key = buildObjectKey(userId, extensionOf(file.name), randomUUID());

    await putObject(key, new Uint8Array(await file.arrayBuffer()), check.contentType);

    return NextResponse.json({
      success: true,
      data: {
        key,
        fileName: file.name,
        fileSize: file.size,
        contentType: check.contentType,
      },
    });
  } catch (error) {
    console.error('Could not store the upload:', error);

    return fail('Could not upload this file. Please try again.', 500);
  }
}
