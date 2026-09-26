'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { updateEditorPreferences } from '@/actions/editor-preferences';
import { DEFAULT_EDITOR_PREFERENCES } from '@/lib/editor-preferences';
import type { EditorPreferences } from '@/types/editor';

/**
 * How long after the last change the preferences are written.
 *
 * Every control saves itself, so setting four of them in a row would otherwise
 * be four writes and four toasts stacked in the corner. Long enough to collect
 * a run of changes, short enough that it still feels like it saved when you
 * stopped.
 */
const SAVE_DEBOUNCE_MS = 600;

interface EditorPreferencesValue {
  preferences: EditorPreferences;
  /** Applies a change now and schedules the write. */
  setPreference: (patch: Partial<EditorPreferences>) => void;
}

const EditorPreferencesContext = createContext<EditorPreferencesValue | null>(null);

/**
 * Holds the signed-in user's editor preferences for the client components that
 * read them: every Monaco editor, and the settings controls that change them.
 *
 * Mounted once, by `AppShell`, which every signed-in page renders inside —
 * `/settings` included, so its controls and the editors share one state. The
 * set is read on the server and handed in, so the first paint is the user's
 * own preferences rather than the defaults replaced a moment later.
 */
export function EditorPreferencesProvider({
  preferences: initialPreferences,
  children,
}: {
  preferences: EditorPreferences;
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);

  // Mirrors the state so a change can be applied to the current value without
  // making the callback depend on it — every editor reads this context, so a
  // callback that changed identity per keystroke of the settings form would
  // re-render all of them.
  const latest = useRef(initialPreferences);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef<EditorPreferences | null>(null);

  const save = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const pending = unsaved.current;
    unsaved.current = null;

    if (!pending) return;

    void updateEditorPreferences(pending).then((result) => {
      if (result.success) {
        toast.success('Editor preferences saved');

        return;
      }

      // The control keeps the value the user chose rather than snapping back.
      // The write failed, not the choice, and an editor that silently reverts
      // under someone mid-change is worse than one telling them to try again.
      toast.error(result.error ?? 'Could not save your preferences.');
    });
  }, []);

  const setPreference = useCallback(
    (patch: Partial<EditorPreferences>) => {
      const next = { ...latest.current, ...patch };

      latest.current = next;
      unsaved.current = next;
      // Applied immediately, so the editor reflects the change while the write
      // is still being waited on.
      setPreferences(next);

      if (timer.current) clearTimeout(timer.current);

      timer.current = setTimeout(save, SAVE_DEBOUNCE_MS);
    },
    [save],
  );

  // Writes a pending change on the way out. Without this, changing a setting
  // and leaving within the debounce window — clicking "Back to dashboard", say
  // — would lose it with no sign that anything had happened.
  useEffect(() => save, [save]);

  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);

  return (
    <EditorPreferencesContext.Provider value={value}>
      {children}
    </EditorPreferencesContext.Provider>
  );
}

/**
 * The current editor preferences.
 *
 * Falls back to the defaults outside a provider rather than throwing, unlike
 * the item drawer's hook. The difference is what a mistake costs: a drawer
 * without its provider has an `openItem` that does nothing, while an editor
 * without one still edits — it just does so at the default font size. An
 * editor that refuses to render is the worse failure of the two.
 */
export function useEditorPreferences(): EditorPreferences {
  return useContext(EditorPreferencesContext)?.preferences ?? DEFAULT_EDITOR_PREFERENCES;
}

/** The preferences plus the setter, for the settings controls. */
export function useEditorPreferencesControls(): EditorPreferencesValue {
  const context = useContext(EditorPreferencesContext);

  if (!context) {
    throw new Error('useEditorPreferencesControls must be used inside an EditorPreferencesProvider');
  }

  return context;
}
