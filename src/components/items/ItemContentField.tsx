'use client';

import { CodeEditor } from '@/components/items/CodeEditor';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { MarkdownEditor } from '@/components/items/MarkdownEditor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usesCodeEditor, usesMarkdownEditor } from '@/lib/items';

interface ItemContentFieldProps {
  /** Prefixes the element id, so the create dialog and the edit form — which
   *  can both be mounted at once — cannot collide on `content`. */
  idPrefix: string;
  /** Which editor to render is a property of the type, so the slug is passed
   *  rather than a pair of booleans a caller could get out of step. */
  slug: string;
  value: string;
  onChange: (value: string) => void;
  /** Syntax highlighting for the code editor; ignored by the other two. */
  language: string;
  codeMinHeight: number;
  markdownMinHeight: number;
  /** The plain textarea sizes with a class rather than a pixel height. */
  textareaClassName: string;
  messages?: string[];
}

/** The Content field: a code editor, a markdown editor or a plain textarea. */
export function ItemContentField({
  idPrefix,
  slug,
  value,
  onChange,
  language,
  codeMinHeight,
  markdownMinHeight,
  textareaClassName,
  messages,
}: ItemContentFieldProps) {
  const id = `${idPrefix}-content`;
  const codeContent = usesCodeEditor(slug);
  const markdownContent = usesMarkdownEditor(slug);
  const invalid = Boolean(messages?.length);

  return (
    <div className="flex flex-col gap-2">
      {/* Neither editor has an element to point a <label for> at, so
          both name themselves through `ariaLabel` instead. */}
      {codeContent || markdownContent ? <Label>Content</Label> : <Label htmlFor={id}>Content</Label>}

      {codeContent ? (
        <CodeEditor
          value={value}
          onChange={onChange}
          language={language}
          minHeight={codeMinHeight}
          ariaLabel="Content"
          aria-invalid={invalid}
        />
      ) : markdownContent ? (
        <MarkdownEditor
          value={value}
          onChange={onChange}
          minHeight={markdownMinHeight}
          ariaLabel="Content"
          aria-invalid={invalid}
        />
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          className={textareaClassName}
        />
      )}
      <ItemFieldError messages={messages} />
    </div>
  );
}
