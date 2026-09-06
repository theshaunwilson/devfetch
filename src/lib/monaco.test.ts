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

const config = vi.fn();

vi.mock('@monaco-editor/react', () => ({ loader: { config } }));

const { EDITOR_THEME, configureMonaco } = await import('./monaco');

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

  it('inherits vs-dark, so only the surfaces are overridden', () => {
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
