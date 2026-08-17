import {
  Code2,
  File,
  FileText,
  Image,
  Link,
  Sparkles,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';

/** Icon names stored on item types, resolved to their lucide component. */
const ICONS: Record<string, LucideIcon> = {
  Code2,
  File,
  FileText,
  Image,
  Link,
  Sparkles,
  SquareTerminal,
};

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? File;
}
