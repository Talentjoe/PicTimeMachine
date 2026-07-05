import {
  buildManifest,
  serializeManifest,
  parseManifest,
  type Manifest,
  type ProjectSettings,
} from './project';
import type { PhotoPoint } from '../types/photo';
import type { Collection } from '../types/collection';
import type { TimelineClip } from '../types/timeline';

/**
 * Auto-saves the current project to localStorage as a **reference manifest**
 * (metadata only: photo paths/coords/dates/descriptions, collections, the
 * timeline — never the image bytes; blob URLs die with the session anyway and
 * photos would blow the storage quota). On the next visit the user re-selects
 * the original image files and `applyReference` re-links them by path/name.
 */

const STORAGE_KEY = 'pic-time-machine.projectCache.v1';

export interface CachedProject {
  savedAt: Date | null;
  manifest: Manifest;
}

/** Persists the current project metadata (best-effort, no image data). */
export function saveProjectCache(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  collections: Collection[],
  timeline: TimelineClip[]
): void {
  try {
    const manifest = serializeManifest(
      buildManifest(photos, settings, collections, timeline, 'reference')
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), manifest })
    );
  } catch {
    // Storage unavailable/full — auto-save silently skips.
  }
}

/** Loads and validates the cached project; null when absent or unusable. */
export function loadProjectCache(): CachedProject | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const envelope: unknown = JSON.parse(raw);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      typeof (envelope as { manifest?: unknown }).manifest !== 'string'
    ) {
      return null;
    }
    const manifest = parseManifest((envelope as { manifest: string }).manifest);
    if (manifest.photos.length === 0) return null;
    const savedAtRaw = (envelope as { savedAt?: unknown }).savedAt;
    const savedAt = typeof savedAtRaw === 'string' ? new Date(savedAtRaw) : null;
    return { savedAt: savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt : null, manifest };
  } catch {
    return null;
  }
}

export function clearProjectCache(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
