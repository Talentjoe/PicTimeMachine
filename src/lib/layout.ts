/**
 * Pure layout math for the map area (React-free, unit-testable).
 *
 * The map viewport can be locked to a fixed aspect ratio so the framing looks
 * identical across devices/window sizes (useful for screen recording). The
 * viewport is letterboxed — centered inside the available area with dark bars
 * filling the rest.
 */

export type AspectId = 'auto' | '16:9' | '4:3' | '1:1' | '9:16';

export const ASPECT_OPTIONS: { id: AspectId; label: string }[] = [
  { id: 'auto', label: '自适应' },
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: '1:1' },
  { id: '9:16', label: '9:16' },
];

const RATIOS: Record<Exclude<AspectId, 'auto'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
};

export function isAspectId(v: unknown): v is AspectId {
  return v === 'auto' || (typeof v === 'string' && v in RATIOS);
}

/**
 * Largest width/height that fits `aspect` inside availW × availH.
 * 'auto' (or a degenerate available area) fills the whole area.
 */
export function computeLetterbox(
  availW: number,
  availH: number,
  aspect: AspectId
): { width: number; height: number } {
  if (aspect === 'auto' || availW <= 0 || availH <= 0) {
    return { width: Math.max(0, availW), height: Math.max(0, availH) };
  }
  const ratio = RATIOS[aspect];
  let width = availW;
  let height = width / ratio;
  if (height > availH) {
    height = availH;
    width = height * ratio;
  }
  return { width, height };
}

/** Clamps a number into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
