'use client';

import { CalendarDays, FolderOpen, Link2, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { TypeIconTile } from '@/components/items/TypeIconTile';
import { ItemDrawerActions } from '@/components/items/ItemDrawerActions';
import { ItemEditForm } from '@/components/items/ItemEditForm';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { capitalize, formatLongDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import type { ItemDetailStatus, ItemDrawerMode } from '@/components/items/ItemDrawerProvider';
import type { DashboardItem, ItemDetail } from '@/types/item';

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  /** The card's own data — present as soon as the drawer opens. */
  item: DashboardItem | null;
  /** The full item, once the request comes back. */
  detail: ItemDetail | null;
  status: ItemDetailStatus;
  mode: ItemDrawerMode;
  onModeChange: (mode: ItemDrawerMode) => void;
  /** Called with the saved item after an edit. */
  onSaved: (item: ItemDetail) => void;
  /** Called once the item has been deleted. */
  onDeleted: () => void;
}

function SectionLabel({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      {Icon && <Icon className="size-3.5" />}
      {children}
    </h3>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

/**
 * Item detail view, as a right-hand drawer. There is no item page — this is it.
 *
 * Everything the card already knew is drawn immediately; only the fields that
 * arrive from `/api/items/[id]` wait behind a skeleton, so opening the drawer
 * never shows an empty panel.
 *
 * Editing happens in the same drawer: the action bar becomes Save and Cancel
 * and the fields become inputs, which is why `ItemEditForm` renders its own
 * header rather than only a body.
 */
export function ItemDrawer({
  open,
  onOpenChange,
  onCloseAutoFocus,
  item,
  detail,
  status,
  mode,
  onModeChange,
  onSaved,
  onDeleted,
}: ItemDrawerProps) {
  // Edit needs the fields only the detail request carries, so it cannot open
  // until that has landed.
  const editing = mode === 'edit' && detail !== null;

  const heading = item && (
    <div className="flex items-start gap-3">
      <TypeIconTile icon={getIcon(item.type.icon)} color={item.type.color} />

      <div className="min-w-0 flex-1">
        <SheetTitle className="text-lg break-words">{item.title}</SheetTitle>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{capitalize(item.type.name)}</Badge>
          {!editing && status === 'loading' && <Skeleton className="h-5 w-20 rounded-4xl" />}
          {/* Hidden while editing: the language has its own input below, and a
              badge beside it would go stale as soon as it was typed in. */}
          {!editing && detail?.language && <Badge variant="outline">{detail.language}</Badge>}
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onCloseAutoFocus={onCloseAutoFocus}
        // Both widths carry the sheet's own `data-[side=right]:` prefix. A
        // plain `w-full sm:max-w-lg` is a different variant, so it loses to
        // the base `w-3/4 sm:max-w-sm` rather than overriding it.
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        // The title alone describes the drawer; there is no summary line to
        // point `aria-describedby` at.
        aria-describedby={undefined}
      >
        {item &&
          (editing && detail ? (
            <ItemEditForm
              // Remounts on a different item, so the inputs re-seed from it
              // rather than keeping what was typed against the previous one.
              key={detail.id}
              item={detail}
              heading={heading}
              onSaved={onSaved}
              onCancel={() => onModeChange('view')}
            />
          ) : (
            <>
              <SheetHeader className="gap-3 border-b p-6 pr-14">
                {heading}

                <ItemDrawerActions
                  itemId={item.id}
                  title={item.title}
                  isFavorite={item.isFavorite}
                  isPinned={item.isPinned}
                  onEdit={() => onModeChange('edit')}
                  canEdit={detail !== null}
                  onDeleted={onDeleted}
                />
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
                {item.description && (
                  <section className="flex flex-col gap-2">
                    <SectionLabel>Description</SectionLabel>
                    <p className="text-sm break-words">{item.description}</p>
                  </section>
                )}

                {status === 'error' ? (
                  <p className="text-sm text-destructive">
                    Could not load this item. Close the drawer and try again.
                  </p>
                ) : (
                  <>
                    {status === 'loading' && (
                      <section className="flex flex-col gap-2">
                        <SectionLabel>Content</SectionLabel>
                        <Skeleton className="h-40 w-full" />
                      </section>
                    )}

                    {detail?.content && (
                      <section className="flex flex-col gap-2">
                        <SectionLabel>Content</SectionLabel>
                        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                          <code>{detail.content}</code>
                        </pre>
                      </section>
                    )}

                    {/* Shown because it is editable: a field you can change has
                        to be readable back, or a save cannot be checked. */}
                    {detail?.url && (
                      <section className="flex flex-col gap-2">
                        <SectionLabel icon={Link2}>URL</SectionLabel>
                        <a
                          href={detail.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm break-all text-primary underline underline-offset-4"
                        >
                          {detail.url}
                        </a>
                      </section>
                    )}

                    <Separator />

                    {item.tags.length > 0 && (
                      <section className="flex flex-col gap-2">
                        <SectionLabel icon={Tag}>Tags</SectionLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </section>
                    )}

                    {(status === 'loading' || detail?.collection) && (
                      <section className="flex flex-col gap-2">
                        <SectionLabel icon={FolderOpen}>Collections</SectionLabel>
                        {detail?.collection ? (
                          <div>
                            <Badge variant="outline">{detail.collection.name}</Badge>
                          </div>
                        ) : (
                          <Skeleton className="h-5 w-32 rounded-4xl" />
                        )}
                      </section>
                    )}

                    <section className="flex flex-col gap-2">
                      <SectionLabel icon={CalendarDays}>Details</SectionLabel>
                      <DetailRow
                        label="Created"
                        value={
                          detail ? (
                            <span className="text-sm">{formatLongDate(detail.createdAt)}</span>
                          ) : (
                            <Skeleton className="h-4 w-28" />
                          )
                        }
                      />
                      <DetailRow
                        label="Updated"
                        value={<span className="text-sm">{formatLongDate(item.updatedAt)}</span>}
                      />
                    </section>
                  </>
                )}
              </div>
            </>
          ))}
      </SheetContent>
    </Sheet>
  );
}
