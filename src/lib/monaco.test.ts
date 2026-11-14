/**
 * `src/lib/monaco.ts` configures the loader as an import side effect, so the
 * module boundary that has to be mocked is `@monaco-editor/react` itself —
 * the same shape as mocking `@/lib/prisma` elsewhere.
 *
 * Two things are worth pinning. The loader path, because reverting it to the
 * library's default would still work in development and only show up as
 * requests to a CDN in production; and the theme name, because a mismatch
 * between what is defined and what the pane asks for renders plain `vs-dark`
 * with none of the app's colours, silently.
 */
import { describe, expect, it, vi } from 'vitest';

import { token } from '../../test/palette';

const config = vi.fn();

vi.mock('@monaco-editor/react', () => ({ loader: { config } }));

const { EDITOR_THEME, configureMonaco, monacoThemeId } = await import('./monaco');
const { DEFAULT_EDITOR_PREFERENCES, EDITOR_THEMES } = await import('./editor-preferences');

/** Only the slice of the Monaco API that `configureMonaco` touches. */
interface FakeMonaco {
  editor: { defineTheme: ReturnType<typeof vi.fn> };
  languages: {
    typescript?: {
      typescriptDefaults: { setDiagnosticsOptions: ReturnType<typeof vi.fn> };
      javascriptDefaults: { setDiagnosticsOptions: ReturnType<typeof vi.fn> };
    };
    json?: { jsonDefaults: { setDiagnosticsOptions: ReturnType<typeof vi.fn> } };
  };
}

function fakeMonaco(overrides: Partial<FakeMonaco['languages']> = {}): FakeMonaco {
  return {
    editor: { defineTheme: vi.fn() },
    languages: {
      typescript: {
        typescriptDefaults: { setDiagnosticsOptions: vi.fn() },
        javascriptDefaults: { setDiagnosticsOptions: vi.fn() },
      },
      json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } },
      ...overrides,
    },
  };
}

// The real signature takes the full Monaco namespace, which cannot be built in
// a test. Casting through `unknown` keeps this typed without reaching for
// `any`, the same way the Prisma mocks are addressed.
const configure = (monaco: FakeMonaco) =>
  configureMonaco(monaco as unknown as Parameters<typeof configureMonaco>[0]);

describe('loader configuration', () => {
  it('points Monaco at this origin, not the library default CDN', () => {
    expect(config).toHaveBeenCalledWith({ paths: { vs: '/monaco/vs' } });
  });

  it('uses a relative path, so it cannot resolve to another host', () => {
    const { paths } = config.mock.calls[0][0] as { paths: { vs: string } };

    expect(paths.vs.startsWith('/')).toBe(true);
    expect(paths.vs.startsWith('//')).toBe(false);
    expect(paths.vs).not.toMatch(/^[a-z]+:/i);
  });
});

describe('configureMonaco', () => {
  it('registers the theme under the name the editor asks for', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(EDITOR_THEME, expect.any(Object));
  });

  it('inherits vs-dark, so a token it does not name still colours', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    const [, theme] = monaco.editor.defineTheme.mock.calls[0];

    expect(theme).toMatchObject({ base: 'vs-dark', inherit: true });
  });

  it('paints the gutter the same colour as the editor body', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    const [, theme] = monaco.editor.defineTheme.mock.calls[0] as [string, { colors: Record<string, string> }];

    expect(theme.colors['editorGutter.background']).toBe(theme.colors['editor.background']);
  });

  it('gives every colour a full hex value Monaco can parse', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    const [, theme] = monaco.editor.defineTheme.mock.calls[0] as [string, { colors: Record<string, string> }];

    for (const value of Object.values(theme.colors)) {
      expect(value).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
    }
  });

  // An item is usually a fragment, not a compilable file, so a saved snippet
  // must not come back covered in red squiggles.
  it('turns off both halves of TypeScript validation', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    const expected = { noSemanticValidation: true, noSyntaxValidation: true };

    expect(monaco.languages.typescript!.typescriptDefaults.setDiagnosticsOptions)
      .toHaveBeenCalledWith(expected);
    expect(monaco.languages.typescript!.javascriptDefaults.setDiagnosticsOptions)
      .toHaveBeenCalledWith(expected);
  });

  it('turns off JSON validation too', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    expect(monaco.languages.json!.jsonDefaults.setDiagnosticsOptions)
      .toHaveBeenCalledWith({ validate: false });
  });

  // The guards are the point: a Monaco build without a language contribution
  // must still get its theme, rather than throwing and leaving no editor.
  it('still registers the theme when the language services are absent', () => {
    const monaco = fakeMonaco({ typescript: undefined, json: undefined });

    expect(() => configure(monaco)).not.toThrow();
    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(EDITOR_THEME, expect.any(Object));
  });
});

/**
 * Monaco ships exactly four themes — `vs`, `vs-dark`, `hc-black`, `hc-light` —
 * so Monokai and GitHub Dark are ours to define. `setTheme` with a name Monaco
 * has not been given does not throw: it leaves whatever was showing in place.
 * So a theme offered in the dropdown but never registered, or registered under
 * a different id, is a setting that silently does nothing.
 */
describe('the offered themes', () => {
  /** Every id handed to `defineTheme` on one pass. */
  function registered() {
    const monaco = fakeMonaco();
    configure(monaco);

    return monaco.editor.defineTheme.mock.calls.map(([id]) => id as string);
  }

  it('registers one Monaco theme for every theme the dropdown offers', () => {
    const ids = registered();

    for (const { id } of EDITOR_THEMES) {
      expect([id, ids.includes(monacoThemeId(id))]).toEqual([id, true]);
    }
  });

  it('registers no theme the dropdown cannot reach', () => {
    const reachable = EDITOR_THEMES.map((theme) => monacoThemeId(theme.id));

    expect(registered().sort()).toEqual(reachable.sort());
  });

  // Defining a theme under a built-in's name would replace it globally, and
  // this one is not VS Code's vs-dark — it is vs-dark over the app's surfaces.
  it('registers nothing under a name Monaco already uses', () => {
    const builtIn = ['vs', 'vs-dark', 'hc-black', 'hc-light'];

    for (const id of registered()) {
      expect([id, builtIn.includes(id)]).toEqual([id, false]);
    }
  });

  it('gives each theme its own id, so one cannot overwrite another', () => {
    const ids = registered();

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('paints each theme its own background, or they are the same theme twice', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    const backgrounds = monaco.editor.defineTheme.mock.calls.map(
      ([, theme]) => (theme as { colors: Record<string, string> }).colors['editor.background'],
    );

    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });

  // Monaco's tokenizer produces fewer scopes than the grammars these palettes
  // come from, so anything unnamed has to inherit rather than fall to plain
  // text — which is what `inherit` off would do.
  it('inherits vs-dark on every theme, so unnamed tokens still colour', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    for (const [, theme] of monaco.editor.defineTheme.mock.calls) {
      expect(theme).toMatchObject({ base: 'vs-dark', inherit: true });
    }
  });

  it('gives every theme real token rules', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    const withRules = monaco.editor.defineTheme.mock.calls.filter(
      ([, theme]) => (theme as { rules: unknown[] }).rules.length > 0,
    );

    expect(withRules).toHaveLength(EDITOR_THEMES.length);
  });

  it('writes every token colour as a hex value without its hash, as Monaco wants', () => {
    const monaco = fakeMonaco();
    configure(monaco);

    for (const [, theme] of monaco.editor.defineTheme.mock.calls) {
      for (const rule of (theme as { rules: { foreground: string }[] }).rules) {
        expect(rule.foreground).toMatch(/^[0-9a-f]{6}$/);
      }
    }
  });
});

describe('monacoThemeId', () => {
  it('maps the default preference to the theme the editor renders by default', () => {
    expect(monacoThemeId(DEFAULT_EDITOR_PREFERENCES.theme)).toBe(EDITOR_THEME);
  });

  it('gives a different id for every theme offered', () => {
    const ids = EDITOR_THEMES.map((theme) => monacoThemeId(theme.id));

    expect(new Set(ids).size).toBe(EDITOR_THEMES.length);
  });

  // A stored value that is no longer offered would otherwise pass through and
  // leave the editor on whichever theme was set last.
  it.each([
    ['a theme that was dropped', 'solarized'],
    ['nothing at all', undefined],
  ])('falls back to the default for %s', (_label, value) => {
    expect(monacoThemeId(value as never)).toBe(EDITOR_THEME);
  });
});

describe('the default theme against the stylesheet', () => {
  // Monaco takes only hex, so the default theme holds copies of the app's
  // tokens. A palette change that missed them would leave the editor in the
  // old colours while everything around it moved.
  const monaco = fakeMonaco();
  configure(monaco);
  const [, theme] = monaco.editor.defineTheme.mock.calls[0] as [
    string,
    { colors: Record<string, string>; rules: { token: string; foreground: string }[] },
  ];
  const rule = (name: string) => `#${theme.rules.find((r) => r.token === name)?.foreground}`;

  it('paints the editor in --card and --foreground, with a --primary caret', () => {
    expect(theme.colors['editor.background']).toBe(token('dark', '--card'));
    expect(theme.colors['editor.foreground']).toBe(token('dark', '--foreground'));
    expect(theme.colors['editorCursor.foreground']).toBe(token('dark', '--primary'));
    expect(theme.colors['editorLineNumber.activeForeground']).toBe(token('dark', '--muted-foreground'));
  });

  it('highlights in the same tokens the homepage mockup uses', () => {
    expect(rule('keyword')).toBe(token('dark', '--syntax-keyword'));
    expect(rule('function')).toBe(token('dark', '--syntax-function'));
    expect(rule('number')).toBe(token('dark', '--syntax-number'));
    expect(rule('string')).toBe(token('dark', '--primary'));
    expect(rule('comment')).toBe(token('dark', '--muted-foreground'));
  });

  it('colours bracket pairs from the palette rather than Monaco defaults', () => {
    expect(theme.colors['editorBracketHighlight.foreground1']).toBe(token('dark', '--favorite'));
    expect(theme.colors['editorBracketHighlight.foreground2']).toBe(token('dark', '--type-prompt'));
    expect(theme.colors['editorBracketHighlight.foreground3']).toBe(token('dark', '--type-snippet'));
  });
});
