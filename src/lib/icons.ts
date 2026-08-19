import {
  Code,
  Code2,
  File,
  FileText,
  Image,
  Link,
  Sparkles,
  SquareTerminal,
  StickyNote,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

/** Icon names stored on item types, resolved to their lucide component. */
const ICONS: Record<string, LucideIcon> = {
  Code,
  Code2,
  File,
  FileText,
  Image,
  Link,
  Sparkles,
  SquareTerminal,
  StickyNote,
  Terminal,
};

export function getIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || File;
}
