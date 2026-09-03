import { NextResponse } from 'next/server';

import { getItemDetail } from '@/lib/db/items';
import { getCurrentUserId } from '@/lib/db/user';
import type { ItemDetailResponse } from '@/types/item';

/**
 * One item in full, for the detail drawer.
 *
 * `src/proxy.ts` deliberately does not match `/api`, so this route does its own
 * auth check: the proxy answers with a redirect to the sign-in page, which a
 * fetch would try to parse as JSON.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/items/[id]'>,
): Promise<NextResponse<ItemDetailResponse>> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Scoped to the signed-in user inside the query as well, so an item
    // belonging to somebody else is a 404 rather than a leak.
    const item = await getItemDetail(id);

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Failed to load item detail:', error);

    return NextResponse.json({ success: false, error: 'Could not load the item' }, { status: 500 });
  }
}
