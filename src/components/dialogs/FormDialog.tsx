'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /**
   * The form, as its own component. It unmounts when the dialog closes, so a
   * half-filled attempt and its errors belong to the attempt that was
   * abandoned, not to the next open.
   */
  children: React.ReactNode;
}

/**
 * The shell every create and edit dialog shares.
 *
 * Controlled from outside rather than carrying its own trigger: several of
 * these open from a `DropdownMenuItem`, which unmounts when its menu closes, so
 * a dialog nested in one would be torn down on the very click that opened it.
 *
 * Capped and column-laid-out rather than left to `DialogContent`'s own `grid`:
 * the snippet form is taller than a short laptop viewport, and the dialog is
 * `fixed` inside an `overflow-hidden` shell, so without this the submit button
 * ends up below the fold with nothing to scroll. `svh` rather than `vh` for the
 * mobile browser chrome.
 */
export function FormDialog({ open, onOpenChange, title, description, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}
      </DialogContent>
    </Dialog>
  );
}

interface FormDialogBodyProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isPending: boolean;
  /** A guard for the button only — the server action re-checks everything. */
  canSubmit: boolean;
  submitLabel: string;
  pendingLabel: string;
  children: React.ReactNode;
}

/**
 * The form inside a `FormDialog`: the fields, then Cancel and submit.
 *
 * Only the fields scroll, so the footer's buttons stay put however tall the
 * fields get.
 */
export function FormDialogBody({
  onSubmit,
  onCancel,
  isPending,
  canSubmit,
  submitLabel,
  pendingLabel,
  children,
}: FormDialogBodyProps) {
  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">{children}</div>

      <DialogFooter className="shrink-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !canSubmit} className="w-full sm:w-auto">
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
