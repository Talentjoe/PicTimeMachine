import { clamp, isAspectId, type AspectId } from './layout';

/**
 * Device-local UI preferences (panel layout, photo display mode, map aspect).
 * These are deliberately NOT part of the project file — they describe how this
 * user's screen is arranged, not the project's content — and live in
 * localStorage only.
 */

export type OverlayMode = 'center' | 'side' | 'auto';

export interface UiPrefs {
  /** Sidebar (media bin / collections) width in px. */
  sidebarWidth: number;
  sidebarSide: 'left' | 'right';
  /** Height of the bottom clip-inspector row in px. */
  bottomHeight: number;
  /** How the photo card is presented during playback. */
  overlayMode: OverlayMode;
  /** Fixed map aspect ratio ('auto' = fill). */
  aspect: AspectId;
}

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 560;
export const BOTTOM_HEIGHT_MIN = 120;
export const BOTTOM_HEIGHT_MAX = 400;

export const DEFAULT_UI_PREFS: UiPrefs = {
  sidebarWidth: 320,
  sidebarSide: 'left',
  bottomHeight: 176,
  overlayMode: 'center',
  aspect: 'auto',
};

const STORAGE_KEY = 'pic-time-machine.uiPrefs.v1';

function isOverlayMode(v: unknown): v is OverlayMode {
  return v === 'center' || v === 'side' || v === 'auto';
}

/** Parses a stored prefs string; unknown/invalid fields fall back to defaults. */
export function parseUiPrefs(raw: string | null): UiPrefs {
  const prefs = { ...DEFAULT_UI_PREFS };
  if (!raw) return prefs;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return prefs;
  }
  if (typeof data !== 'object' || data === null) return prefs;
  const d = data as Record<string, unknown>;
  if (typeof d.sidebarWidth === 'number' && Number.isFinite(d.sidebarWidth)) {
    prefs.sidebarWidth = clamp(d.sidebarWidth, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
  }
  if (d.sidebarSide === 'left' || d.sidebarSide === 'right') prefs.sidebarSide = d.sidebarSide;
  if (typeof d.bottomHeight === 'number' && Number.isFinite(d.bottomHeight)) {
    prefs.bottomHeight = clamp(d.bottomHeight, BOTTOM_HEIGHT_MIN, BOTTOM_HEIGHT_MAX);
  }
  if (isOverlayMode(d.overlayMode)) prefs.overlayMode = d.overlayMode;
  if (isAspectId(d.aspect)) prefs.aspect = d.aspect;
  return prefs;
}

export function serializeUiPrefs(prefs: UiPrefs): string {
  return JSON.stringify(prefs);
}

/** Loads prefs from localStorage (safe in private mode / SSR). */
export function loadUiPrefs(): UiPrefs {
  try {
    return parseUiPrefs(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

/** Persists prefs to localStorage (best-effort). */
export function saveUiPrefs(prefs: UiPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeUiPrefs(prefs));
  } catch {
    // Storage unavailable (private mode, quota) — layout just won't persist.
  }
}
