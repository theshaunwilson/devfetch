import {
  File,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';

import { extensionOf } from '@/lib/uploads';

/**
 * The icon a file row draws, by extension.
 *
 * Display only — nothing here decides what may be uploaded or how it is served;
 * `uploads.ts` owns both. It covers every extension that module accepts, which
 * a test asserts by reading that list rather than repeating it, so an extension
 * added there cannot quietly fall back to the generic icon.
 */
const FILE_ICONS: Record<string, LucideIcon> = {
  // Documents and prose.
  '.pdf': FileText,
  '.txt': FileText,
  '.md': FileText,
  // Structured data and config.
  '.json': FileJson,
  '.yaml': FileCode,
  '.yml': FileCode,
  '.xml': FileCode,
  '.toml': FileCode,
  '.ini': FileCode,
  // Tabular.
  '.csv': FileSpreadsheet,
};

/**
 * The icon for a filename, falling back to a generic file for anything not in
 * the table — including a name with no extension at all.
 */
export function getFileIcon(fileName: string | null | undefined): LucideIcon {
  if (!fileName) return File;

  return FILE_ICONS[extensionOf(fileName)] ?? File;
}
