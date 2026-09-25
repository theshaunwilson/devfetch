// Fails the build if a client component imports this: it holds the bucket's
// credentials, and nothing in the browser has any business with them.
import 'server-only';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * Cloudflare R2, over its S3-compatible API.
 *
 * Nothing here is public: objects are read back through `/api/files/[id]`,
 * which checks that the signed-in user owns the item naming them. The bucket's
 * public r2.dev URL is deliberately not used, and `R2_PUBLIC_URL` is not read —
 * a public URL would make every upload readable by anyone holding the link,
 * with no way to take it back short of deleting the object.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Read at call time, never at module scope: a value captured on import would
 * be whatever was set during `next build`, which is the trap `src/lib/features.ts`
 * and `src/lib/rate-limit.ts` both avoid.
 */
function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

let cached: { client: S3Client; bucket: string } | null = null;

/**
 * Built lazily and kept, so one client is reused across requests rather than
 * rebuilt per upload. Throws rather than returning a broken client, so a
 * missing variable fails at the one call site that can report it instead of
 * surfacing later as an unexplained network error.
 */
function storage(): { client: S3Client; bucket: string } {
  if (cached) return cached;

  const config = readConfig();

  if (!config) {
    throw new Error('R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.');
  }

  cached = {
    client: new S3Client({
      // R2 ignores the region but the SDK insists on one.
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    bucket: config.bucket,
  };

  return cached;
}

/** Stores one object. `contentType` is ours, derived from the extension. */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const { client, bucket } = storage();

  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

/**
 * Fetches one object as a web stream, so the route can hand it straight to the
 * response without buffering ten megabytes to serve them.
 *
 * Returns null when the object is not there, which a missing key and a key the
 * bucket never held both look like.
 */
export async function getObjectStream(key: string): Promise<ReadableStream | null> {
  const { client, bucket } = storage();

  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

    return result.Body?.transformToWebStream() ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;

    throw error;
  }
}

/**
 * Removes one object.
 *
 * S3 delete is idempotent — removing a key that is not there is a success —
 * which is what the caller wants: an item whose object has already gone should
 * still delete cleanly.
 */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = storage();

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Removes every object under one user's prefix, returning how many it removed.
 *
 * For account deletion, which has no other way to find uploads that were
 * abandoned before their item was saved. Refuses anything but a
 * `users/<id>/` prefix, so a bug upstream can never hand it `''` — which would
 * list, and delete, the whole bucket.
 *
 * One `DeleteObject` per key rather than a batched `DeleteObjects`: the SDK's
 * default request checksums on the batch call are a known compatibility gap
 * with R2, and an account holds few enough objects that the difference does
 * not matter.
 */
export async function deleteObjectsWithPrefix(prefix: string): Promise<number> {
  if (!/^users\/[^/]+\/$/.test(prefix)) {
    throw new Error(`Refusing to delete by an unscoped prefix: "${prefix}"`);
  }

  const { client, bucket } = storage();
  let removed = 0;
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      if (!object.Key) continue;

      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      removed += 1;
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return removed;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound')
  );
}
