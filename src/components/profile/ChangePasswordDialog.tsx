'use client';

import { useState } from 'react';

import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/** Opens the change-password form, which is otherwise unchanged. */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          Change password
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password, then choose a new one.
          </DialogDescription>
        </DialogHeader>

        {/* Remounted on each open (the content unmounts when closed), so a
            success banner from a previous visit never greets the next one. */}
        <ChangePasswordForm />
      </DialogContent>
    </Dialog>
  );
}
