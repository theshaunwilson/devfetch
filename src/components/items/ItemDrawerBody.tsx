'use client';

import { CalendarDays, FolderOpen, Link2, Paperclip, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { CodeEditor } from '@/components/items/CodeEditor';
import { ItemFilePanel } from '@/components/items/ItemFilePanel';
import { MarkdownEditor } from '@/components/items/MarkdownEditor';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLongDate } from '@/lib/format';
import { usesCodeEditor, usesMarkdownEditor } from '@/lib/items';
import { isImageUploadType } from '@/lib/uploads';
import type { DashboardItem, ItemDetail, ItemDetailStatus } from '@/types/item';

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

interface ItemDrawerBodyProps {
  /** The card's own data — present as soon as the drawer opens. */
  item: DashboardItem;
  /** The full item, once the request comes back. */
  detail: ItemDetail | null;
  status: ItemDetailStatus;
}

/**
 * The read-only body of the item drawer: everything below the header.
 *
 * What the card already knew — description, tags, updated date — draws
 * immediately; only the fields carried by `/api/items/[id]` wait behind a
 * skeleton.
 */
export function ItemDrawerBody({ item, detail, status }: ItemDrawerBodyProps) {
  return (
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
              {/* Code types get Monaco read-only, prose types get
                  the rendered markdown. The <pre> is the fallback
                  for a custom type, which has content but neither
                  editor. */}
              {usesCodeEditor(detail.type.slug) ? (
                <CodeEditor
                  value={detail.content}
                  language={detail.language}
                  readOnly
                  minHeight={80}
                  ariaLabel={`${detail.title} content`}
                />
              ) : usesMarkdownEditor(detail.type.slug) ? (
                <MarkdownEditor
                  value={detail.content}
                  readOnly
                  minHeight={140}
                  ariaLabel={`${detail.title} content`}
                />
              ) : (
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                  <code>{detail.content}</code>
                </pre>
              )}
            </section>
          )}

          {detail?.fileUrl && (
            <section className="flex flex-col gap-2">
              <SectionLabel icon={Paperclip}>
                {isImageUploadType(detail.type.slug) ? 'Image' : 'File'}
              </SectionLabel>
              <ItemFilePanel item={detail} />
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

          {(status === 'loading' || (detail?.collections.length ?? 0) > 0) && (
            <section className="flex flex-col gap-2">
              <SectionLabel icon={FolderOpen}>Collections</SectionLabel>
              {detail ? (
                // One badge per collection: an item can be filed in several.
                <div className="flex flex-wrap gap-1.5">
                  {detail.collections.map((collection) => (
                    <Badge key={collection.id} variant="outline">
                      {collection.name}
                    </Badge>
                  ))}
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
  );
}
