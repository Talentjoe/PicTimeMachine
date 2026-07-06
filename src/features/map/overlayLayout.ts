import type { OverlayMode } from '../../lib/uiPrefs';

/**
 * Where the focused marker should sit relative to the map-viewport center
 * (pixels; +x right, +y down) so it stays clear of the photo overlay:
 * - center/auto: overlay card fills the middle → marker in the lower-left margin.
 * - side: overlay docks right ~45% → marker centered in the visible left part.
 * - none: no overlay (locating from the bin, editing) → marker dead center.
 *
 * The whole clip flies once using its overlay-visible ("hold") framing — we
 * deliberately don't re-aim mid-clip when the move/hold phase flips, which
 * would restart the fly animation.
 */
export function overlayFocusOffset(
  mode: OverlayMode | 'none',
  mapW: number,
  mapH: number
): [number, number] {
  if (mapW <= 0 || mapH <= 0) return [0, 0];
  switch (mode) {
    case 'center':
    case 'auto':
      return [Math.round(-0.32 * mapW), Math.round(0.22 * mapH)];
    case 'side':
      return [Math.round(-0.225 * mapW), 0];
    case 'small':
      // The corner card barely occludes the center — keep the marker centered.
      return [0, 0];
    default:
      return [0, 0];
  }
}
