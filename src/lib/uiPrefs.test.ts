import { parseUiPrefs, serializeUiPrefs, DEFAULT_UI_PREFS } from './uiPrefs';

describe('parseUiPrefs', () => {
  it('returns defaults for null / garbage / non-object input', () => {
    expect(parseUiPrefs(null)).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefs('not json')).toEqual(DEFAULT_UI_PREFS);
    expect(parseUiPrefs('42')).toEqual(DEFAULT_UI_PREFS);
  });

  it('round-trips a full prefs object', () => {
    const prefs = {
      sidebarWidth: 400,
      sidebarSide: 'right' as const,
      bottomHeight: 200,
      overlayMode: 'side' as const,
      aspect: '16:9' as const,
    };
    expect(parseUiPrefs(serializeUiPrefs(prefs))).toEqual(prefs);
  });

  it('clamps out-of-range numbers', () => {
    const parsed = parseUiPrefs(JSON.stringify({ sidebarWidth: 9999, bottomHeight: 1 }));
    expect(parsed.sidebarWidth).toBe(560);
    expect(parsed.bottomHeight).toBe(120);
  });

  it('falls back per-field on invalid values', () => {
    const parsed = parseUiPrefs(
      JSON.stringify({ sidebarSide: 'top', overlayMode: 'huge', aspect: '21:9', sidebarWidth: 300 })
    );
    expect(parsed.sidebarSide).toBe(DEFAULT_UI_PREFS.sidebarSide);
    expect(parsed.overlayMode).toBe(DEFAULT_UI_PREFS.overlayMode);
    expect(parsed.aspect).toBe(DEFAULT_UI_PREFS.aspect);
    expect(parsed.sidebarWidth).toBe(300);
  });
});
