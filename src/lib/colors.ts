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

export function textColorClass(hex: string): string {
  return TEXT_COLORS[hex] ?? 'text-muted-foreground';
}
