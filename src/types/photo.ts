/**
 * A single photo parsed from a user-selected image file (or restored from a
 * project file).
 *
 * `lat`/`lng`/`date` are nullable because not every image carries valid EXIF
 * GPS or timestamp data; such photos are still listed but filtered out of the
 * map. Coordinates are WGS-84 (the EXIF standard); conversion to GCJ-02 for
 * Chinese basemaps happens at render time in the map layer (see lib/geo.ts).
 *
 * The position of a PhotoPoint within the `images` array IS its display order
 * (drag-to-reorder and sort-by-time simply reorder the array).
 */
export interface PhotoPoint {
  /** Stable id (used for React keys, drag-and-drop, and lookups). */
  id: string;
  name: string;
  /** Relative path (file.webkitRelativePath) or, if unavailable, the file name. */
  path: string;
  /** Object URL created via URL.createObjectURL for in-browser preview. */
  url: string;
  /** Optional user caption, shown in the marker popup and saved in the project file. */
  description: string;
  /** How many seconds this photo occupies on the timeline (default 1). */
  duration: number;
  /** Map zoom level to use when focusing this photo during playback (default DEFAULT_ZOOM). */
  zoom?: number;
  /** Per-photo photo-card override during playback; undefined = follow the global mode. */
  overlay?: PhotoOverlaySetting;
  lat: number | null;
  lng: number | null;
  date: Date | null;
}

/** Per-photo override for the playback photo card ('hidden' = show no card). */
export type PhotoOverlaySetting = 'center' | 'side' | 'small' | 'hidden';

/** Type guard for overlay values read from project files. */
export function isPhotoOverlaySetting(v: unknown): v is PhotoOverlaySetting {
  return v === 'center' || v === 'side' || v === 'small' || v === 'hidden';
}

/** Default map zoom level when focusing a single photo. */
export const DEFAULT_ZOOM = 13;

/** A PhotoPoint guaranteed to have coordinates and a date (post-filter). */
export interface LocatedPhoto extends PhotoPoint {
  lat: number;
  lng: number;
  date: Date;
}

/** Type guard: true when a photo has usable coordinates and timestamp. */
export function isLocated(photo: PhotoPoint): photo is LocatedPhoto {
  return photo.lat != null && photo.lng != null && photo.date != null;
}

/** Generates a stable id, falling back when crypto.randomUUID is unavailable. */
export function newId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Generates a stable photo id. */
export function newPhotoId(): string {
  return newId('photo');
}
