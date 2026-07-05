import { newId } from './photo';

/**
 * The timeline is an ordered list of **clips**, decoupled from the photo bin.
 * A clip can show a single photo, a whole collection (an "establishing shot"),
 * or nothing at all (an empty gap / pause). A photo may appear zero, one, or
 * many times across the timeline — the bin order no longer dictates playback.
 *
 * Each clip is split into two phases that together make up its length:
 * - `moveDuration` — seconds the map spends flying to this clip's target. The
 *   Leaflet fly animation runs for exactly this long, so the visible camera
 *   motion stays in sync with the timeline.
 * - `holdDuration` — seconds the map then dwells while the photo is shown.
 *
 * Time advance never waits on the map animation (the playhead keeps flowing),
 * which keeps playback non-blocking.
 */
export type ClipKind = 'photo' | 'collection' | 'gap';

export interface TimelineClip {
  /** Stable clip id (distinct from any photo or collection id). */
  id: string;
  kind: ClipKind;
  /** photoId (kind 'photo') | collectionId (kind 'collection'); undefined for 'gap'. */
  refId?: string;
  /** Seconds the map flies to this clip's target. */
  moveDuration: number;
  /** Seconds the map dwells after arriving. */
  holdDuration: number;
  /** Optional zoom override for photo/gap clips (defaults to the photo's zoom). */
  zoom?: number;
}

/** Default fly time when a clip is created. */
export const DEFAULT_MOVE = 1;
/** Default dwell time when a clip is created. */
export const DEFAULT_HOLD = 2;

/** Generates a stable clip id. */
export function newClipId(): string {
  return newId('clip');
}

/** Total seconds a clip occupies on the timeline (move + hold, clamped ≥ 0). */
export function clipLength(clip: TimelineClip): number {
  return Math.max(0, clip.moveDuration) + Math.max(0, clip.holdDuration);
}

export interface Schedule {
  /** Cumulative start offset (seconds) of each clip; boundaries[0] === 0. */
  boundaries: number[];
  /** Sum of every clip's length. */
  total: number;
}

/** Derives per-clip start offsets and the total length (pure, React-free). */
export function deriveSchedule(clips: TimelineClip[]): Schedule {
  const boundaries: number[] = [];
  let acc = 0;
  for (const clip of clips) {
    boundaries.push(acc);
    acc += clipLength(clip);
  }
  return { boundaries, total: acc };
}

/** Largest i with boundaries[i] <= t; -1 when there are no clips. */
export function clipIndexAt(t: number, boundaries: number[]): number {
  let idx = -1;
  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i] <= t) idx = i;
    else break;
  }
  return idx;
}

/** Whether the local time within a clip falls in its move or hold phase. */
export function clipPhase(clip: TimelineClip, localTime: number): 'move' | 'hold' {
  return localTime < Math.max(0, clip.moveDuration) ? 'move' : 'hold';
}

export interface ClipProgress {
  /** Active clip index (same semantics as clipIndexAt); -1 when none. */
  index: number;
  /** Fraction 0..1 of the active clip already elapsed (1 for zero-length clips). */
  progress: number;
}

/**
 * Resolves the active clip and how far into it `t` falls. Used by the timeline
 * playhead, whose x position is no longer linear in time (clips render at a
 * fixed width regardless of duration).
 */
export function clipProgressAt(t: number, boundaries: number[], clips: TimelineClip[]): ClipProgress {
  const index = clipIndexAt(t, boundaries);
  if (index < 0 || index >= clips.length) return { index: -1, progress: 0 };
  const len = clipLength(clips[index]);
  if (len <= 0) return { index, progress: 1 };
  const local = t - boundaries[index];
  return { index, progress: Math.min(1, Math.max(0, local / len)) };
}

/** Creates a photo clip (default move + hold). */
export function photoClip(photoId: string, zoom?: number): TimelineClip {
  return {
    id: newClipId(),
    kind: 'photo',
    refId: photoId,
    moveDuration: DEFAULT_MOVE,
    holdDuration: DEFAULT_HOLD,
    zoom,
  };
}

/** Creates a collection clip (fit-bounds over the collection's members). */
export function collectionClip(collectionId: string): TimelineClip {
  return {
    id: newClipId(),
    kind: 'collection',
    refId: collectionId,
    moveDuration: DEFAULT_MOVE,
    holdDuration: DEFAULT_HOLD,
  };
}

/** Creates an empty gap clip (a pause — no move, just a hold). */
export function gapClip(): TimelineClip {
  return {
    id: newClipId(),
    kind: 'gap',
    moveDuration: 0,
    holdDuration: DEFAULT_HOLD,
  };
}
