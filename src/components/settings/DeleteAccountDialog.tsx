'use client';

import { useActionState, useState } from 'react';

import { deleteAccount, type DeleteAccountState } from '@/actions/profile';
import { FieldError } from '@/components/auth/FieldError';
import { FormMessage } from '@/components/auth/FormMessage';
import { SubmitButton } from '@/components/auth/SubmitButton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteAccountDialogProps {
  /** The address that has to be typed back. Compared again on the server. */
  email: string;
  itemCount: number;
  collectionCount: number;
}

export function DeleteAccountDialog({
  email,
  itemCount,
  collectionCount,
}: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [state, formAction] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});

  // Normalized the same way the schema and the server comparison are, so
  // stray padding or a capital letter does not block a correct address.
  const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing throws the typed confirmation away, so reopening never
        // starts with the button already armed.
        if (!next) setConfirmation('');
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full sm:w-auto">
          Delete account
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account, {itemCount}{' '}
            {itemCount === 1 ? 'item' : 'items'} and {collectionCount}{' '}
            {collectionCount === 1 ? 'collection' : 'collections'}, along with every tag and custom
            type you own. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.error && <FormMessage>{state.error}</FormMessage>}

        {/* The submit is a plain button rather than `AlertDialogAction`:
            that one closes the dialog on click, which would unmount this form
            and cancel the submission before it reached the server. */}
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {/* `block`, not the Label's default `flex`: a flex row does not
                wrap, so a longer address than the seeded demo one ran past
                the dialog's right edge. `break-all` covers an address with
                no break opportunity in it at all. */}
            <Label htmlFor="confirmEmail" className="block">
              Type <span className="font-mono break-all text-foreground">{email}</span> to confirm
            </Label>
            <Input
              id="confirmEmail"
              name="confirmEmail"
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.confirmEmail)}
              aria-describedby={state.fieldErrors?.confirmEmail ? 'confirm-email-error' : undefined}
            />
            <FieldError id="confirm-email-error" messages={state.fieldErrors?.confirmEmail} />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton
              variant="destructive"
              pendingLabel="Deleting…"
              // Armed only once the address matches. The server checks it
              // again, so this is a guard rail and not the authority.
              disabled={!matches}
            >
              Delete account
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
