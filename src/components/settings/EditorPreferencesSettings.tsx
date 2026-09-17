'use client';

import { useEditorPreferencesControls } from '@/components/editor/EditorPreferencesProvider';
import { SettingsRow } from '@/components/settings/SettingsRow';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { EDITOR_FONT_SIZES, EDITOR_TAB_SIZES, EDITOR_THEMES } from '@/lib/editor-preferences';
import type { EditorPreferences, EditorThemeId } from '@/types/editor';

/**
 * How the code editor looks, for snippets and commands.
 *
 * There is no save button: each control writes as it changes, debounced in the
 * provider so a run of changes is one write and one toast rather than five.
 * Which means nothing here tracks a pending or dirty state — the value shown
 * is the value in use, immediately, and the toast is what reports the write.
 */
export function EditorPreferencesSettings() {
  const { preferences, setPreference } = useEditorPreferencesControls();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor</CardTitle>
        <CardDescription>
          How the code editor looks when you read and write snippets and commands.
        </CardDescription>
      </CardHeader>

      <CardContent className="divide-y">
        <SettingsRow
          htmlFor="editor-font-size"
          title="Font size"
          description="The size of the text in the code editor"
          action={
            <NumberSelect
              id="editor-font-size"
              values={EDITOR_FONT_SIZES}
              value={preferences.fontSize}
              onChange={(fontSize) => setPreference({ fontSize })}
              format={(size) => `${size}px`}
            />
          }
        />

        <SettingsRow
          htmlFor="editor-tab-size"
          title="Tab size"
          description="How many spaces a tab is worth"
          action={
            <NumberSelect
              id="editor-tab-size"
              values={EDITOR_TAB_SIZES}
              value={preferences.tabSize}
              onChange={(tabSize) => setPreference({ tabSize })}
              format={(size) => `${size} spaces`}
            />
          }
        />

        <SettingsRow
          htmlFor="editor-theme"
          title="Theme"
          description="The colour scheme the editor renders in"
          action={
            <Select
              value={preferences.theme}
              onValueChange={(theme) => setPreference({ theme: theme as EditorThemeId })}
            >
              <SelectTrigger id="editor-theme" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEMES.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <SettingsRow
          htmlFor="editor-word-wrap"
          title="Word wrap"
          description="Wrap long lines instead of scrolling sideways"
          action={
            <Switch
              id="editor-word-wrap"
              checked={preferences.wordWrap}
              onCheckedChange={(wordWrap) => setPreference({ wordWrap })}
            />
          }
        />

        <SettingsRow
          htmlFor="editor-minimap"
          title="Minimap"
          description="Show the code overview down the right-hand side"
          action={
            <Switch
              id="editor-minimap"
              checked={preferences.minimap}
              onCheckedChange={(minimap) => setPreference({ minimap })}
            />
          }
        />
      </CardContent>
    </Card>
  );
}

/**
 * A select over a fixed list of numbers.
 *
 * Radix carries its value as a string, so the number has to survive a round
 * trip through one. It comes back by lookup in the same array the options were
 * rendered from rather than by `Number()`, which keeps the literal type — the
 * point of that type being that a size not on the menu cannot reach Monaco.
 */
function NumberSelect<T extends EditorPreferences['fontSize'] | EditorPreferences['tabSize']>({
  id,
  values,
  value,
  onChange,
  format,
}: {
  id: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => {
        const chosen = values.find((option) => String(option) === next);

        if (chosen !== undefined) onChange(chosen);
      }}
    >
      <SelectTrigger id={id} className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {format(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
