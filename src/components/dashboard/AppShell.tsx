import { cookies } from 'next/headers';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { SidebarProvider } from '@/components/dashboard/SidebarProvider';
import { Topbar } from '@/components/dashboard/Topbar';
import { EditorPreferencesProvider } from '@/components/editor/EditorPreferencesProvider';
import { ItemDrawerProvider } from '@/components/items/ItemDrawerProvider';
import { Toaster } from '@/components/ui/sonner';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { getCollectionOptions, getSidebarCollections } from '@/lib/db/collections';
import { getItemTypes } from '@/lib/db/item-types';
import { getSearchItems } from '@/lib/db/items';
import { getCurrentUser, getEditorPreferences } from '@/lib/db/user';
import { SEARCH_ITEM_LIMIT } from '@/lib/search';
import { isSidebarOpen, SIDEBAR_COOKIE } from '@/lib/sidebar';

const SIDEBAR_COLLECTION_LIMIT = 5;

/**
 * Sidebar and top bar chrome, shared by every signed-in route that renders
 * inside it. The layout that mounts it must be `force-dynamic`, since the
 * sidebar reads its types and collections per request.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [
    itemTypes,
    collections,
    collectionOptions,
    searchItems,
    user,
    editorPreferences,
    cookieStore,
  ] = await Promise.all([
      getItemTypes(),
      getSidebarCollections(SIDEBAR_COLLECTION_LIMIT),
      // The full list, for the item forms' collections picker and the command
      // palette. The sidebar's own collections are split into favorites and a
      // capped recent list, so they cannot stand in for it.
      getCollectionOptions(),
      // The palette searches on the client, so its index is pre-fetched here
      // rather than queried per keystroke.
      getSearchItems(SEARCH_ITEM_LIMIT),
      getCurrentUser(),
      // Every Monaco editor in the app is under this shell, and each reads its
      // font size, theme and the rest from context rather than fetching them.
      getEditorPreferences(),
      cookies(),
    ]);

  // Read on the server so the first paint already has the right width. The
  // two sections mount their own AppShell, so this is also what carries the
  // choice across a move between /dashboard and /items.
  const sidebarOpen = isSidebarOpen(cookieStore.get(SIDEBAR_COOKIE)?.value);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* Outside the shell's `overflow-hidden`, and mounted here rather than in
          the root layout: toasts belong to the signed-in app, and the auth
          pages report themselves with inline banners. */}
      <Toaster position="bottom-right" />

      {/* Wraps the whole shell rather than each list, so the one drawer serves
          the dashboard's two lists, the items grid and the command palette in
          the top bar alike — the palette opens an item the same way a card
          does, so it has to sit under this. Its edit form's collection options
          are handed in rather than fetched by the drawer: it is the same list
          the top bar's dialog uses, so one query serves both. */}
      {/* Above the drawer, since the drawer's own editors read from it — and
          around the top bar too, whose create dialog renders one as well. */}
      <EditorPreferencesProvider preferences={editorPreferences}>
        <ItemDrawerProvider collectionOptions={collectionOptions}>
          <div className="flex h-svh overflow-hidden">
            <Sidebar itemTypes={itemTypes} collections={collections} user={user} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar
                itemTypes={itemTypes}
                collectionOptions={collectionOptions}
                searchItems={searchItems}
              />
              {/* `tabIndex={-1}` so focus has somewhere to land when the element
                  it would have returned to is gone — see the drawer's
                  `onCloseAutoFocus`.

                  `@container/main` so the grids inside can size off the space
                  they actually occupy. A viewport breakpoint cannot see the
                  sidebar: `md:grid-cols-2` doubled the collection grid at the
                  very width the 256px sidebar appeared, cutting cards to 224px
                  and truncating their titles. It also means collapsing the
                  sidebar now widens the columns, which it never did. */}
              <main
                id={MAIN_CONTENT_ID}
                tabIndex={-1}
                className="@container/main flex-1 overflow-y-auto outline-none"
              >
                {children}
              </main>
            </div>
          </div>
        </ItemDrawerProvider>
      </EditorPreferencesProvider>
    </SidebarProvider>
  );
}
