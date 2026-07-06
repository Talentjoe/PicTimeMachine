import JSZip from 'jszip';
import {
  newPhotoId,
  DEFAULT_ZOOM,
  isPhotoOverlaySetting,
  type PhotoPoint,
  type PhotoOverlaySetting,
} from '../types/photo';
import type { Collection } from '../types/collection';
import {
  DEFAULT_MOVE,
  DEFAULT_HOLD,
  newClipId,
  type TimelineClip,
  type ClipKind,
} from '../types/timeline';

/** Global settings persisted alongside the photos in a project file. */
export interface ProjectSettings {
  defaultDuration: number;
  isChina: boolean;
  provider: string;
}

/** One photo entry inside the manifest. `file` is its path within the zip. */
export interface ManifestPhoto {
  /** Persisted so collections + clips (which reference photo ids) survive a reload. */
  id: string;
  file: string;
  name: string;
  path: string;
  description: string;
  /** Default seconds suggested for new clips of this photo. */
  duration: number;
  zoom: number;
  /** Per-photo playback photo-card override; absent = follow the global mode. */
  overlay?: PhotoOverlaySetting;
  lat: number | null;
  lng: number | null;
  /** ISO string, or null when the photo has no timestamp. */
  date: string | null;
}

/** One timeline clip inside the manifest (same shape as a runtime TimelineClip). */
export type ManifestClip = TimelineClip;

export type ProjectMode = 'full' | 'reference';

export interface Manifest {
  version: 3;
  /** 'full' = images bundled in the zip; 'reference' = metadata-only .json. */
  mode: ProjectMode;
  settings: ProjectSettings;
  /** The photo bin. Array order is the bin order (independent of the timeline). */
  photos: ManifestPhoto[];
  collections: Collection[];
  /** The ordered timeline track of clips. */
  timeline: ManifestClip[];
}

/** Result of loading any project file. */
export interface LoadedProject {
  photos: PhotoPoint[];
  collections: Collection[];
  timeline: TimelineClip[];
}

const MANIFEST_NAME = 'manifest.json';
const IMAGE_DIR = 'images';

/** Makes a filesystem-safe, collision-free zip entry name for a photo. */
function zipEntryName(photo: PhotoPoint, index: number): string {
  const safe = photo.name.replace(/[\\/]/g, '_');
  return `${IMAGE_DIR}/${String(index).padStart(4, '0')}_${safe}`;
}

/** Builds a default timeline (one photo clip per located manifest photo). */
function defaultTimeline(photos: ManifestPhoto[]): ManifestClip[] {
  return photos
    .filter((p) => p.lat != null && p.lng != null && p.date != null)
    .map((p) => ({
      id: newClipId(),
      kind: 'photo' as ClipKind,
      refId: p.id,
      moveDuration: DEFAULT_MOVE,
      holdDuration: DEFAULT_HOLD,
    }));
}

/**
 * Builds the manifest (pure). Assigns each photo a deterministic zip entry name
 * so exportProject and the manifest agree on file locations. Photo array order
 * is the bin order; the timeline is stored separately.
 */
export function buildManifest(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  collections: Collection[],
  timeline: TimelineClip[],
  mode: ProjectMode
): Manifest {
  return {
    version: 3,
    mode,
    settings,
    collections,
    timeline: timeline.map((c) => ({
      id: c.id,
      kind: c.kind,
      refId: c.refId,
      moveDuration: c.moveDuration,
      holdDuration: c.holdDuration,
      zoom: c.zoom,
    })),
    photos: photos.map((p, i) => ({
      id: p.id,
      file: zipEntryName(p, i),
      name: p.name,
      path: p.path,
      description: p.description,
      duration: p.duration,
      zoom: p.zoom ?? DEFAULT_ZOOM,
      overlay: p.overlay,
      lat: p.lat,
      lng: p.lng,
      date: p.date ? p.date.toISOString() : null,
    })),
  };
}

export function serializeManifest(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2);
}

/** Normalises one raw clip entry, filling in missing fields. */
function normalizeClip(c: Partial<ManifestClip>): ManifestClip {
  const kind: ClipKind = c.kind === 'collection' || c.kind === 'gap' ? c.kind : 'photo';
  return {
    id: c.id ?? newClipId(),
    kind,
    refId: kind === 'gap' ? undefined : c.refId,
    moveDuration: c.moveDuration ?? (kind === 'gap' ? 0 : DEFAULT_MOVE),
    holdDuration: c.holdDuration ?? DEFAULT_HOLD,
    zoom: c.zoom,
  };
}

/** Parses + normalises a v3 manifest (older formats are not supported). */
export function parseManifest(json: string): Manifest {
  const parsed = JSON.parse(json) as {
    version?: number;
    mode?: ProjectMode;
    settings?: ProjectSettings;
    collections?: Collection[];
    photos?: Partial<ManifestPhoto>[];
    timeline?: Partial<ManifestClip>[];
  };
  if (!parsed || parsed.version !== 3 || !Array.isArray(parsed.photos)) {
    throw new Error('无法识别的项目文件（manifest 格式不正确或版本过旧）');
  }
  const photos: ManifestPhoto[] = parsed.photos.map((p) => ({
    id: p.id ?? newPhotoId(),
    file: p.file ?? '',
    name: p.name ?? '',
    path: p.path ?? p.name ?? '',
    description: p.description ?? '',
    duration: p.duration ?? parsed.settings?.defaultDuration ?? 1,
    zoom: p.zoom ?? DEFAULT_ZOOM,
    overlay: isPhotoOverlaySetting(p.overlay) ? p.overlay : undefined,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    date: p.date ?? null,
  }));
  const timeline =
    Array.isArray(parsed.timeline) && parsed.timeline.length
      ? parsed.timeline.map(normalizeClip)
      : defaultTimeline(photos);
  return {
    version: 3,
    mode: parsed.mode ?? 'full',
    settings: parsed.settings ?? { defaultDuration: 1, isChina: false, provider: 'amap' },
    collections: Array.isArray(parsed.collections) ? parsed.collections : [],
    photos,
    timeline,
  };
}

/** Reconstructs a PhotoPoint from a manifest entry + an object URL. */
function entryToPhoto(entry: ManifestPhoto, url: string): PhotoPoint {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    url,
    description: entry.description,
    duration: entry.duration,
    zoom: entry.zoom,
    overlay: entry.overlay,
    lat: entry.lat,
    lng: entry.lng,
    date: entry.date ? new Date(entry.date) : null,
  };
}

/** Drops photoIds from collections that no photo provides (e.g. unmatched references). */
function pruneCollections(collections: Collection[], photos: PhotoPoint[]): Collection[] {
  const ids = new Set(photos.map((p) => p.id));
  return collections.map((c) => ({ ...c, photoIds: c.photoIds.filter((id) => ids.has(id)) }));
}

/** Drops clips whose referenced photo/collection no longer exists (gaps always kept). */
function pruneTimeline(
  timeline: TimelineClip[],
  photos: PhotoPoint[],
  collections: Collection[]
): TimelineClip[] {
  const photoIds = new Set(photos.map((p) => p.id));
  const colIds = new Set(collections.map((c) => c.id));
  return timeline.filter((c) => {
    if (c.kind === 'photo') return c.refId != null && photoIds.has(c.refId);
    if (c.kind === 'collection') return c.refId != null && colIds.has(c.refId);
    return true;
  });
}

/**
 * Builds a self-contained .zip project: manifest.json + every image's bytes.
 * Re-openable with importProject without re-selecting the original folder.
 * `compress` toggles DEFLATE vs. plain STORE.
 */
export async function exportProject(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  collections: Collection[],
  timeline: TimelineClip[],
  opts: { compress: boolean }
): Promise<Blob> {
  const manifest = buildManifest(photos, settings, collections, timeline, 'full');
  const zip = new JSZip();
  zip.file(MANIFEST_NAME, serializeManifest(manifest));

  await Promise.all(
    photos.map(async (photo, i) => {
      const blob = await fetch(photo.url).then((r) => r.blob());
      zip.file(manifest.photos[i].file, blob);
    })
  );

  return zip.generateAsync({
    type: 'blob',
    compression: opts.compress ? 'DEFLATE' : 'STORE',
  });
}

/** Exports a lightweight reference-only .json (metadata + paths, no image bytes). */
export function exportReference(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  collections: Collection[],
  timeline: TimelineClip[]
): Blob {
  const manifest = buildManifest(photos, settings, collections, timeline, 'reference');
  return new Blob([serializeManifest(manifest)], { type: 'application/json' });
}

/** Reconstructs a project (photos with fresh object URLs) from a .zip project file. */
export async function importProject(file: File): Promise<LoadedProject> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file(MANIFEST_NAME);
  if (!manifestFile) throw new Error('项目文件缺少 manifest.json');

  const manifest = parseManifest(await manifestFile.async('string'));

  const photos = (
    await Promise.all(
      manifest.photos.map(async (entry): Promise<PhotoPoint | null> => {
        const imageFile = zip.file(entry.file);
        if (!imageFile) {
          console.warn(`项目文件缺少图片：${entry.file}`);
          return null;
        }
        const blob = await imageFile.async('blob');
        return entryToPhoto(entry, URL.createObjectURL(blob));
      })
    )
  ).filter((p): p is PhotoPoint => p !== null);

  const collections = pruneCollections(manifest.collections, photos);
  return { photos, collections, timeline: pruneTimeline(manifest.timeline, photos, collections) };
}

/** Parses a reference-only .json file into a manifest (no images yet). */
export async function parseReferenceJson(file: File): Promise<Manifest> {
  return parseManifest(await file.text());
}

/**
 * Re-attaches a reference manifest to actual image files the user re-selected,
 * matching by relative path first, then by file name. Unmatched entries are
 * dropped (and their ids pruned from collections + the timeline).
 */
export function applyReference(manifest: Manifest, files: File[]): LoadedProject {
  const byPath = new Map<string, File>();
  const byName = new Map<string, File>();
  for (const f of files) {
    byPath.set(f.webkitRelativePath || f.name, f);
    byName.set(f.name, f);
  }

  const photos: PhotoPoint[] = [];
  for (const entry of manifest.photos) {
    const file = byPath.get(entry.path) ?? byName.get(entry.name);
    if (!file) {
      console.warn(`未找到引用图片：${entry.path}`);
      continue;
    }
    photos.push(entryToPhoto(entry, URL.createObjectURL(file)));
  }

  const collections = pruneCollections(manifest.collections, photos);
  return { photos, collections, timeline: pruneTimeline(manifest.timeline, photos, collections) };
}
