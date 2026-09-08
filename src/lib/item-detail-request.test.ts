/**
 * These branches had no coverage while they lived inside `ItemDrawerProvider`:
 * the suite does not test components, so the parse, the two failure shapes and
 * the abort behaviour were only ever verified by hand in a browser.
 *
 * `fetch` is mocked at the global, which is the module boundary here — there
 * is no network and no server.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchItemDetail } from './item-detail-request';
import type { ItemDetail } from '@/types/item';

const DETAIL = { id: 'item_1', title: 'A snippet' } as unknown as ItemDetail;

function mockFetch(value: unknown) {
  const spy = vi.fn().mockResolvedValue(value);
  vi.stubGlobal('fetch', spy);

  return spy;
}

/** Only what `fetchItemDetail` reads off a Response. */
function response(ok: boolean, body: unknown) {
  return { ok, json: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchItemDetail', () => {
  it('asks the item route for the id it was given', async () => {
    const spy = mockFetch(response(true, { success: true, data: DETAIL }));
    const signal = new AbortController().signal;

    await fetchItemDetail('item_1', signal);

    expect(spy).toHaveBeenCalledWith('/api/items/item_1', { signal });
  });

  it('returns the item on a successful response', async () => {
    mockFetch(response(true, { success: true, data: DETAIL }));

    await expect(fetchItemDetail('item_1')).resolves.toBe(DETAIL);
  });

  it('throws the route its own message when the body reports failure', async () => {
    // The route answers 404 with { success: false, error }, and that message
    // is more use than a generic one.
    mockFetch(response(false, { success: false, error: 'Item not found' }));

    await expect(fetchItemDetail('missing')).rejects.toThrow('Item not found');
  });

  it('throws on a non-ok response even when the body claims success', async () => {
    // The status is not allowed to disagree with the body unnoticed.
    mockFetch(response(false, { success: true, data: DETAIL }));

    await expect(fetchItemDetail('item_1')).rejects.toThrow('Could not load the item');
  });

  it('rejects when the body is not JSON at all', async () => {
    // A proxy error page, say. json() rejects and that reaches the caller.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      })
    );

    await expect(fetchItemDetail('item_1')).rejects.toThrow(SyntaxError);
  });

  it('lets an AbortError through rather than turning it into a load failure', async () => {
    // The property the drawer's race guard depends on: an aborted request was
    // replaced by a newer one, which is not the same as failing, and the
    // caller narrows on this exact error to tell them apart.
    const aborted = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));

    await expect(fetchItemDetail('item_1')).rejects.toBe(aborted);
    await expect(fetchItemDetail('item_1')).rejects.toSatisfy(
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
    );
  });
});
