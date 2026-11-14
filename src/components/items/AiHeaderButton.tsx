'use client';

import { Crown, Loader2, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Header-sized, so the button sits level with the tabs and the copy button,
 * but outlined in full-strength text rather than muted like the chrome around
 * it: the header is otherwise decoration, and this is the one thing in it
 * that does something a reader would not guess was there.
 */
const HEADER_BUTTON = 'h-6 gap-1 px-2 text-[11px] font-medium';

interface AiHeaderButtonProps {
  isPro: boolean;
  /** The resting label, such as "Explain with AI". */
  label: string;
  /** Shown while the request runs, such as "Explaining…". */
  pendingLabel: string;
  isPending: boolean;
  /** What the button promises, for the tooltip. */
  hint: string;
  onClick: () => void;
  /** The free account's click, which opens the upgrade toast. */
  onUpgrade: () => void;
}

/**
 * The AI action in an editor's window-chrome header — Explain with AI on code,
 * Optimize with AI on prompts — so the two look and behave as one control.
 *
 * A free account gets the same button with a crown: shown rather than hidden,
 * since a hidden feature cannot be sold. The tooltip says why it is locked, and
 * the click opens the upgrade toast — a tooltip never appears on touch, so the
 * click has to say it too. The server refuses regardless; this is presentation,
 * not the gate.
 */
export function AiHeaderButton({
  isPro,
  label,
  pendingLabel,
  isPending,
  hint,
  onClick,
  onUpgrade,
}: AiHeaderButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={HEADER_BUTTON}
          onClick={isPro ? onClick : onUpgrade}
          disabled={isPro && isPending}
        >
          {!isPro ? (
            <Crown className="size-3 text-pro" aria-hidden="true" />
          ) : isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <WandSparkles className="size-3" aria-hidden="true" />
          )}
          {isPro && isPending ? pendingLabel : label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isPro ? hint : `${hint}. AI features require Pro subscription.`}</TooltipContent>
    </Tooltip>
  );
}
