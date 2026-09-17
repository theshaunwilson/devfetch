'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';

import { useEditorPreferences } from '@/components/editor/EditorPreferencesProvider';
import { configureMonaco, monacoThemeId } from '@/lib/monaco';
import { monacoLanguage } from '@/lib/code-language';
import { EDITOR_MAX_HEIGHT } from '@/lib/constants';
import { editorLineHeight } from '@/lib/editor-preferences';

interface CodeEditorPaneProps {
  value: string;
  onChange?: (value: string) => void;
  language: string | null | undefined;
  readOnly: boolean;
  /** Floor for the fluid height, so an empty editor is still usable. */
  minHeight: number;
  /** Names the editor for assistive tech, since there is no real <label>. */
  ariaLabel?: string;
}

/**
 * The Monaco editor itself, split out so it can be loaded with `ssr: false`.
 *
 * Monaco is browser-only and large, so it must not be in the initial bundle —
 * `CodeEditor` is the half that renders on the server, and this is the half
 * that arrives when an editor is actually on screen.
 */
export function CodeEditorPane({
  value,
  onChange,
  language,
  readOnly,
  minHeight,
  ariaLabel,
}: CodeEditorPaneProps) {
  // The user's own settings, applied to display and editing alike — a snippet
  // should look the same being read as being written.
  const preferences = useEditorPreferences();

  const [height, setHeight] = useState(minHeight);
  const heightRef = useRef(minHeight);

  // A model is keyed on its path, so two editors sharing the default path
  // would share their content. One per component instance.
  const path = `inmemory://item/${useId()}`;

  const clamp = useCallback(
    (contentHeight: number) => Math.min(Math.max(contentHeight, minHeight), EDITOR_MAX_HEIGHT),
    [minHeight],
  );

  const handleMount = useCallback<OnMount>(
    (editor) => {
      // Fluid height: Monaco lays out into whatever box it is given, so the
      // box has to follow the content rather than the other way round.
      // `scrollBeyondLastLine: false` below is what makes the reported content
      // height the height of the text and not a screenful more.
      const applyHeight = () => {
        const next = clamp(editor.getContentHeight());

        if (next !== heightRef.current) {
          heightRef.current = next;
          setHeight(next);
        }
      };

      editor.onDidContentSizeChange(applyHeight);
      applyHeight();
    },
    [clamp],
  );

  return (
    <Editor
      path={path}
      value={value}
      onChange={(next) => onChange?.(next ?? '')}
      language={monacoLanguage(language)}
      theme={monacoThemeId(preferences.theme)}
      beforeMount={configureMonaco}
      onMount={handleMount}
      height={height}
      loading={<EditorPlaceholder minHeight={minHeight} />}
      options={{
        readOnly,
        // Monaco builds its own hidden textarea, so the accessible name has to
        // be handed to it rather than attached with a <label for>.
        ariaLabel,
        // Keeps the browser's own caret and text selection out of a read-only
        // editor, so it reads as a code block rather than a disabled input.
        domReadOnly: readOnly,
        renderLineHighlight: readOnly ? 'none' : 'line',
        minimap: { enabled: preferences.minimap },
        // Monaco's own default is 'off', which is what this was before the
        // setting existed. On means long lines wrap rather than scrolling
        // sideways, which also keeps the fluid height honest: a wrapped line
        // is taller, and `onDidContentSizeChange` reports that.
        wordWrap: preferences.wordWrap ? 'on' : 'off',
        // Required for getContentHeight() to mean "how tall is the text".
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: preferences.fontSize,
        // Derived rather than fixed: a 20px line box around 16px text would be
        // cramped. The ratio reproduces the 20 this had at the default size.
        lineHeight: editorLineHeight(preferences.fontSize),
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        padding: { top: 12, bottom: 12 },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          // Lets the drawer and the dialog keep scrolling once the editor has
          // hit its own end, instead of swallowing the wheel.
          alwaysConsumeMouseWheel: false,
        },
        // The chrome an editor this small does not earn: a ruler strip and a
        // fold column would cost width the drawer has little of.
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        folding: false,
        lineNumbersMinChars: 3,
        contextmenu: false,
        // Autocomplete on a stored snippet would suggest against the fragment
        // itself, which is noise rather than help.
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        wordBasedSuggestions: 'off',
        parameterHints: { enabled: false },
        hover: { enabled: 'off' },
        occurrencesHighlight: 'off',
        renderWhitespace: 'none',
        tabSize: preferences.tabSize,
      }}
    />
  );
}

function EditorPlaceholder({ minHeight }: { minHeight: number }) {
  return (
    <div
      className="flex w-full items-center justify-center text-xs text-muted-foreground"
      style={{ height: minHeight }}
    >
      Loading editor…
    </div>
  );
}
