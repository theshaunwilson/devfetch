/**
 * Item types and collections carry a hex color in the data model.
 * Styling uses Tailwind classes only, so hex values are mapped here
 * instead of being applied as inline styles.
 */
const TEXT_COLORS: Record<string, string> = {
  '#3b82f6': 'text-blue-500',
  '#38bdf8': 'text-sky-400',
  '#22c55e': 'text-green-500',
  '#a855f7': 'text-purple-500',
  '#ec4899': 'text-pink-500',
  '#f97316': 'text-orange-500',
  '#eab308': 'text-yellow-500',
  '#94a3b8': 'text-slate-400',
  '#e2e8f0': 'text-slate-200',
};

const BORDER_COLORS: Record<string, string> = {
  '#3b82f6': 'border-l-blue-500',
  '#38bdf8': 'border-l-sky-400',
  '#22c55e': 'border-l-green-500',
  '#a855f7': 'border-l-purple-500',
  '#ec4899': 'border-l-pink-500',
  '#f97316': 'border-l-orange-500',
  '#eab308': 'border-l-yellow-500',
  '#94a3b8': 'border-l-slate-400',
  '#e2e8f0': 'border-l-slate-200',
};

const SOFT_BG_COLORS: Record<string, string> = {
  '#3b82f6': 'bg-blue-500/10',
  '#38bdf8': 'bg-sky-400/10',
  '#22c55e': 'bg-green-500/10',
  '#a855f7': 'bg-purple-500/10',
  '#ec4899': 'bg-pink-500/10',
  '#f97316': 'bg-orange-500/10',
  '#eab308': 'bg-yellow-500/10',
  '#94a3b8': 'bg-slate-400/10',
  '#e2e8f0': 'bg-slate-200/10',
};

export function textColorClass(hex: string): string {
  return TEXT_COLORS[hex] ?? 'text-muted-foreground';
}

/** Left accent border used on collection and item cards. */
export function borderColorClass(hex: string): string {
  return BORDER_COLORS[hex] ?? 'border-l-border';
}

/** Tinted background used behind item type icons. */
export function softBgColorClass(hex: string): string {
  return SOFT_BG_COLORS[hex] ?? 'bg-muted';
}
