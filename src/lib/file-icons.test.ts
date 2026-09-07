/**
 * Which icon a file row draws. Cosmetic on its own, but the coverage assertion
 * is not: it reads the accepted extensions out of `uploads.ts` rather than
 * repeating them, so an extension added there and forgotten here fails a test
 * instead of silently falling back to the generic icon.
 */
import { File, FileCode, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { getFileIcon } from './file-icons';
import { uploadConstraintsFor } from './uploads';

describe('getFileIcon', () => {
  it('gives documents and prose the text icon', () => {
    expect(getFileIcon('report.pdf')).toBe(FileText);
    expect(getFileIcon('notes.txt')).toBe(FileText);
    expect(getFileIcon('README.md')).toBe(FileText);
  });

  it('gives config formats the code icon and JSON its own', () => {
    expect(getFileIcon('package.json')).toBe(FileJson);

    for (const name of ['docker.yaml', 'ci.yml', 'pom.xml', 'Cargo.toml', 'php.ini']) {
      expect(getFileIcon(name)).toBe(FileCode);
    }
  });

  it('gives tabular data the spreadsheet icon', () => {
    expect(getFileIcon('export.csv')).toBe(FileSpreadsheet);
  });

  it('matches the extension case-insensitively, as stored names vary', () => {
    expect(getFileIcon('REPORT.PDF')).toBe(FileText);
    expect(getFileIcon('Data.CsV')).toBe(FileSpreadsheet);
  });

  it('falls back to a generic file for an unknown extension', () => {
    expect(getFileIcon('archive.zip')).toBe(File);
  });

  it('falls back for a name with no extension, and for a dotfile', () => {
    expect(getFileIcon('LICENSE')).toBe(File);
    // `.env` is a dotfile, not an extension — `extensionOf` returns ''.
    expect(getFileIcon('.env')).toBe(File);
  });

  it('falls back when there is no file at all, which a file item may have', () => {
    expect(getFileIcon(null)).toBe(File);
    expect(getFileIcon(undefined)).toBe(File);
    expect(getFileIcon('')).toBe(File);
  });

  it('covers every extension an upload is allowed to use', () => {
    const constraints = uploadConstraintsFor('file');

    expect(constraints).not.toBeNull();

    for (const extension of constraints!.extensions) {
      // The generic icon is the fallback, so hitting it means the extension
      // has no entry of its own.
      expect(getFileIcon(`upload${extension}`)).not.toBe(File);
    }
  });
});
