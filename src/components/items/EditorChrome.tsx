'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** How long the copy button stays confirmed before going back to its icon. */
const COPIED_FEEDBACK_MS = 2000;

/** The traffic lights. Decorative, so they are hidden from assistive tech. */
export function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
      <span className="size-2.5 rounded-full bg-[#febc2e]" />
      <span className="size-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}

interface CopyButtonProps {
  /**
   * The live buffer, not the saved value: mid-edit, what is on screen is what
   * the user means by "copy this".
   */
  value: string;
  /** Distinguishes "Copy code" from "Copy markdown" for a screen reader. */
  label: string;
}

/**
 * The copy button both editors put in their window chrome.
 *
 * Shared rather than copied: the clipboard's failure handling and the confirm
 * timer are the sort of detail that drifts once there are two of them, and the
 * two editors sit next to each other in the same drawer.
 */
export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (an insecure origin, or a denied
      // permission). Nothing was copied, so the button simply does not
      // confirm — a toast for a failed copy would be louder than the action.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-6 text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      // The state is announced here rather than by swapping the label, so a
      // screen reader hears the confirmation the icon shows.
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
