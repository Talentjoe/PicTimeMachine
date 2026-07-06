import { clamp, isAspectId, type AspectId } from './layout';

/**
 * Device-local UI preferences (panel layout, photo display mode, map aspect).
 * These are deliberately NOT part of the project file — they describe how this
 * user's screen is arranged, not the project's content — and live in
 * localStorage only.
 */

export type OverlayMode = 'center' | 'side' | 'auto' | 'small';

/** Dragged position of the small photo card (top-left anchor, % of the map viewport). */
export interface SmallOverlayPos {
  xPct: number;
  yPct: number;
}

export interface UiPrefs {
  /** Sidebar (media bin / collections) width in px. */
  sidebarWidth: number;
  sidebarSide: 'left' | 'right';
  /** Height of the whole bottom block (timeline + clip inspector) in px. */
  bottomAreaHeight: number;
  /** Width of the clip-inspector column in px. */
  inspectorWidth: number;
  /** How the photo card is presented during playback. */
  overlayMode: OverlayMode;
  /** Fixed map aspect ratio ('auto' = fill). */
  aspect: AspectId;
  /** Where the user dragged the small photo card; null = bottom-right default. */
  smallOverlayPos: SmallOverlayPos | null;
}

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 560;
export const BOTTOM_AREA_HEIGHT_MIN = 170;
export const BOTTOM_AREA_HEIGHT_MAX = 560;
export const INSPECTOR_WIDTH_MIN = 260;
export const INSPECTOR_WIDTH_MAX = 560;

export const DEFAULT_UI_PREFS: UiPrefs = {
  sidebarWidth: 320,
  sidebarSide: 'left',
  bottomAreaHeight: 240,
  inspectorWidth: 340,
  overlayMode: 'center',
  aspect: 'auto',
  smallOverlayPos: null,
};

const STORAGE_KEY = 'pic-time-machine.uiPrefs.v1';

function isOverlayMode(v: unknown): v is OverlayMode {
  return v === 'center' || v === 'side' || v === 'auto' || v === 'small';
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
  if (typeof d.bottomAreaHeight === 'number' && Number.isFinite(d.bottomAreaHeight)) {
    prefs.bottomAreaHeight = clamp(
      d.bottomAreaHeight,
      BOTTOM_AREA_HEIGHT_MIN,
      BOTTOM_AREA_HEIGHT_MAX
    );
  }
  if (typeof d.inspectorWidth === 'number' && Number.isFinite(d.inspectorWidth)) {
    prefs.inspectorWidth = clamp(d.inspectorWidth, INSPECTOR_WIDTH_MIN, INSPECTOR_WIDTH_MAX);
  }
  if (isOverlayMode(d.overlayMode)) prefs.overlayMode = d.overlayMode;
  if (isAspectId(d.aspect)) prefs.aspect = d.aspect;
  const pos = d.smallOverlayPos;
  if (typeof pos === 'object' && pos !== null) {
    const p = pos as Record<string, unknown>;
    if (
      typeof p.xPct === 'number' &&
      Number.isFinite(p.xPct) &&
      typeof p.yPct === 'number' &&
      Number.isFinite(p.yPct)
    ) {
      prefs.smallOverlayPos = { xPct: clamp(p.xPct, 0, 100), yPct: clamp(p.yPct, 0, 100) };
    }
  }
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
