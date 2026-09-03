# Item Types

Reference for the seven built-in item types: where each one is defined, what it
looks like, and which `Item` fields it actually uses.

Generated from `context/project-overview.md`, `prisma/schema.prisma`,
`prisma/seed.ts`, `src/lib/icons.ts`, `src/lib/colors.ts`, `src/lib/pro.ts`,
and the live `development` Neon branch (`br-gentle-tooth-zavtxrsu`).

> **Note on sources.** The research prompt named `src/lib/constants.tsx` — that
> file does not exist. Type definitions are not centralized in a constants
> module. They are split across four places:
>
> | Concern | Location |
> | --- | --- |
> | Name, slug, icon name, hex color | `prisma/seed.ts` → `SYSTEM_ITEM_TYPES` (written to the `ItemType` table) |
> | Icon name → lucide component | `src/lib/icons.ts` → `ICONS` / `getIcon()` |
> | Hex color → Tailwind class | `src/lib/colors.ts` → `TEXT_COLORS`, `BORDER_COLORS`, `SOFT_BG_COLORS` |
> | Which types are Pro | `src/lib/pro.ts` → `PRO_TYPE_SLUGS` |
>
> The **database is the source of truth at runtime**; the seed file is the
> source of truth for what gets written there.

---

## The seven types

All seven are system types: `isSystem = true`, `userId = null` (global, shared
by every account). Order below is `createdAt asc`, which is the seed order and
the order the sidebar and profile breakdown render in.

### 1. Snippet

| | |
| --- | --- |
| **Slug** | `snippet` |
| **Icon** | `Code` (lucide) |
| **Color** | `#3b82f6` → `text-blue-500` / `border-l-blue-500` / `bg-blue-500/10` |
| **Pro** | No |
| **Purpose** | Reusable code — hooks, utilities, config files, patterns |
| **Key fields** | `content` (the code), `language` (syntax highlighting), `description` |
| **Seeded rows** | 4 |

Languages seen live: `typescript`, `dockerfile`.

### 2. Prompt

| | |
| --- | --- |
| **Slug** | `prompt` |
| **Icon** | `Sparkles` |
| **Color** | `#8b5cf6` → `text-violet-500` / `border-l-violet-500` / `bg-violet-500/10` |
| **Pro** | No |
| **Purpose** | AI prompts and workflow instructions |
| **Key fields** | `content` (the prompt text), `description` |
| **Seeded rows** | 3 |

`language` is null on every prompt row — prompts are prose, not code.

### 3. Command

| | |
| --- | --- |
| **Slug** | `command` |
| **Icon** | `Terminal` |
| **Color** | `#f97316` → `text-orange-500` / `border-l-orange-500` / `bg-orange-500/10` |
| **Pro** | No |
| **Purpose** | Shell/CLI one-liners worth not retyping |
| **Key fields** | `content` (the command), `language` (`bash` on all rows), `description` |
| **Seeded rows** | 5 |

Field usage is identical to Snippet — the difference is semantic (a command is
meant to be run, a snippet to be pasted into a file), not structural.

### 4. Note

| | |
| --- | --- |
| **Slug** | `note` |
| **Icon** | `StickyNote` |
| **Color** | `#fde047` → `text-yellow-300` / `border-l-yellow-300` / `bg-yellow-300/10` |
| **Pro** | No |
| **Purpose** | Freeform markdown notes and documentation |
| **Key fields** | `content` (markdown), `description` |
| **Seeded rows** | **0** |

Not exercised by any seeded data. The markdown editor named in the spec's
"Additional Features" does not exist yet, so this type has never been rendered
with real content.

### 5. File

| | |
| --- | --- |
| **Slug** | `file` |
| **Icon** | `File` |
| **Color** | `#6b7280` → `text-gray-500` / `border-l-gray-500` / `bg-gray-500/10` |
| **Pro** | **Yes** — `PRO` badge in the sidebar |
| **Purpose** | Uploaded documents, templates, context files |
| **Key fields** | `fileUrl`, `fileName`, `fileSize`, `contentType = "file"` |
| **Seeded rows** | **0** |

The only type whose `contentType` is meant to be `"file"`. Storage (Cloudflare
R2) and uploads are unbuilt, so **no row anywhere has a non-null `fileUrl`,
`fileName` or `fileSize`** — those three columns are entirely unused today.

### 6. Image

| | |
| --- | --- |
| **Slug** | `image` |
| **Icon** | `Image` |
| **Color** | `#ec4899` → `text-pink-500` / `border-l-pink-500` / `bg-pink-500/10` |
| **Pro** | **Yes** — `PRO` badge in the sidebar |
| **Purpose** | Screenshots, diagrams, design references |
| **Key fields** | Same as File: `fileUrl`, `fileName`, `fileSize`, `contentType = "file"` |
| **Seeded rows** | **0** |

Structurally identical to File; the split exists so images can be previewed
inline where files would be listed. Image uploads were moved from Free to Pro
in the spec during the Pro-badge feature.

### 7. Link

| | |
| --- | --- |
| **Slug** | `link` |
| **Icon** | `Link` |
| **Color** | `#10b981` → `text-emerald-500` / `border-l-emerald-500` / `bg-emerald-500/10` |
| **Pro** | No |
| **Purpose** | Bookmarked docs, tools and references |
| **Key fields** | `url`, `description` |
| **Seeded rows** | 6 — the most used type |

**Named `URL` in `context/project-overview.md` but `link` everywhere in code
and data.** The slug, name, icon name and route (`/items/link`) all use `link`;
only the spec bullet says URL.

---

## Summary: text vs file vs URL

The `Item` model has a `contentType` column documented as `"text" | "file"` —
**two values, not three.** The three-way split below is by which content column
a type populates, which is *not* the same axis:

| Class | Types | Content lives in | `contentType` value |
| --- | --- | --- | --- |
| **Text** | Snippet, Prompt, Command, Note | `content` (+ `language` where it's code) | `"text"` |
| **File** | File, Image | `fileUrl`, `fileName`, `fileSize` | `"file"` |
| **URL** | Link | `url` | `"text"` ← **the default, not a third value** |

Verified live: all 18 items on the development branch have
`contentType = "text"`, including all 6 link rows, which have `content = NULL`
and `url` set. So `contentType` today distinguishes *text vs file*, and a link
is classified as text by default rather than by any deliberate write. Nothing
reads `contentType` in `src/` yet, so this has no visible effect — but a future
filter on `contentType = 'text'` would sweep links in with snippets.

### Shared properties

Every type, whatever its class, carries the same envelope from `Item`:

| Field | Notes |
| --- | --- |
| `id`, `title` | `title` is the only required content field |
| `description` | Nullable; set on all 18 seeded rows. `ItemRow` and `CollectionCard` guard it |
| `isFavorite`, `isPinned` | Drive the star and pin markers, the Pinned list and two stat tiles |
| `typeId` → `ItemType` | `onDelete: Restrict` — a type can never be deleted out from under its items |
| `collectionId` → `Collection` | Nullable, `onDelete: SetNull` — deleting a collection orphans items rather than removing them |
| `tags` → `ItemTag[]` | Many-to-many, rendered alphabetically (join rows have no natural order) |
| `userId` → `User` | `onDelete: Cascade` |
| `createdAt`, `updatedAt` | `updatedAt desc` drives both Recent lists |

Every optional content field (`content`, `url`, `language`, `fileUrl`,
`fileName`, `fileSize`) is nullable on **all** types — the schema does not
enforce which fields a type uses. That contract lives only in the seed data and
in whatever a create form eventually validates.

### Display differences

There are **none by type today**. Every item renders through the same
`ItemRow`, and all per-type variation is data-driven off `ItemType.icon` and
`ItemType.color`:

| Surface | What varies per type |
| --- | --- |
| `ItemRow` | Left border (`borderColorClass`), icon tile background (`softBgColorClass`), icon glyph + tint (`getIcon`, `textColorClass`) |
| `CollectionCard` | A tinted icon per distinct type in the collection, ordered by usage then name |
| `SidebarContent` → Types | Icon, tinted label, item count, `PRO` badge on `file` and `image` |
| `ProfileStats` | Icon tile + count per type, same ordering |

No type gets a different layout, a code block, an image preview, or a
type-specific field. `language` is stored but **never read by any component** —
no syntax highlighting is wired up. A link's `url` is likewise stored and never
rendered.

Names are stored lowercase and singular (`"snippet"`), capitalized at render —
`capitalize()` in `SidebarContent`, `class="capitalize"` in `ProfileStats`.

### Color and icon coverage

All seven seeded hexes are present in all three maps in `src/lib/colors.ts`,
and all seven icon names are present in `ICONS`. **No type falls back** to
`text-muted-foreground`, `border-l-border`, `bg-muted` or the default `File`
icon. Adding a type with an unmapped color or icon degrades silently to those
fallbacks rather than erroring.

---

## Custom types

`ItemType.userId` is nullable specifically to support them: `null` = built-in
global, set = a Pro user's own type. `@@unique([userId, slug])` scopes slugs
per user, and `getItemTypes()` queries `OR: [{ userId: null }, { userId }]`
because a plain `userId` filter would miss the built-ins.

Ordering is `createdAt asc`, so custom types always append after the seven
built-ins — confirmed during the profile feature, where a test `Recipe` type
appeared as an eighth breakdown row.

Nothing creates custom types yet. `isProType()` covers only the two built-in
Pro slugs; custom types are Pro by definition and are not in that set.

---

## Known gaps

1. **`/items/[slug]` has no route.** The sidebar links every type to
   `/items/${type.slug}`, but the only pages that exist are `/`, `/dashboard`,
   `/profile` and the four auth pages. Every type row currently 404s.
2. **No item CRUD.** Items exist only via `prisma/seed.ts`. There is no create,
   edit or delete path, so no code enforces which fields a type may use.
3. **Three types have zero rows** — note, file, image. Their rendering has never
   been exercised against real data.
4. **`fileUrl` / `fileName` / `fileSize` are unused columns.** File storage is
   unbuilt.
5. **`language` is stored but never read.** No syntax highlighting exists
   despite it being a spec feature.
6. **Spec says `URL`, code says `link`.** Worth reconciling in
   `context/project-overview.md` before the type route is built.
7. **`contentType` does not distinguish links.** They take the `"text"` default.
8. **The `PRO` badge is a marker only** — the rows stay live links, nothing is
   disabled, and no gating is enforced ahead of billing.
