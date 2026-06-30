import JSZip from 'jszip';
import { newPhotoId, DEFAULT_ZOOM, type PhotoPoint } from '../types/photo';
import type { Collection } from '../types/collection';

/** Global settings persisted alongside the photos in a project file. */
export interface ProjectSettings {
  defaultDuration: number;
  isChina: boolean;
  provider: string;
}

/** One photo entry inside the manifest. `file` is its path within the zip. */
export interface ManifestPhoto {
  /** Persisted so collections (which reference photo ids) survive a reload. */
  id: string;
  file: string;
  name: string;
  path: string;
  description: string;
  duration: number;
  zoom: number;
  lat: number | null;
  lng: number | null;
  /** ISO string, or null when the photo has no timestamp. */
  date: string | null;
}

export type ProjectMode = 'full' | 'reference';

export interface Manifest {
  version: 2;
  /** 'full' = images bundled in the zip; 'reference' = metadata-only .json. */
  mode: ProjectMode;
  settings: ProjectSettings;
  /** Array order is the display order. */
  photos: ManifestPhoto[];
  collections: Collection[];
}

/** Result of loading any project file. */
export interface LoadedProject {
  photos: PhotoPoint[];
  collections: Collection[];
}

const MANIFEST_NAME = 'manifest.json';
const IMAGE_DIR = 'images';

/** Makes a filesystem-safe, collision-free zip entry name for a photo. */
function zipEntryName(photo: PhotoPoint, index: number): string {
  const safe = photo.name.replace(/[\\/]/g, '_');
  return `${IMAGE_DIR}/${String(index).padStart(4, '0')}_${safe}`;
}

/**
 * Builds the manifest (pure). Assigns each photo a deterministic zip entry name
 * so exportProject and the manifest agree on file locations. Array order is
 * preserved as display order.
 */
export function buildManifest(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  collections: Collection[],
  mode: ProjectMode
): Manifest {
  return {
    version: 2,
    mode,
    settings,
    collections,
    photos: photos.map((p, i) => ({
      id: p.id,
      file: zipEntryName(p, i),
      name: p.name,
      path: p.path,
      description: p.description,
      duration: p.duration,
      zoom: p.zoom ?? DEFAULT_ZOOM,
      lat: p.lat,
      lng: p.lng,
      date: p.date ? p.date.toISOString() : null,
    })),
  };
}

export function serializeManifest(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2);
}

/** Parses + normalises a manifest, tolerating older v1 files. */
export function parseManifest(json: string): Manifest {
  const parsed = JSON.parse(json) as {
    version?: number;
    mode?: ProjectMode;
    settings?: ProjectSettings;
    collections?: Collection[];
    photos?: Partial<ManifestPhoto>[];
  };
  if (!parsed || (parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.photos)) {
    throw new Error('无法识别的项目文件（manifest 格式不正确）');
  }
  return {
    version: 2,
    mode: parsed.mode ?? 'full',
    settings: parsed.settings ?? { defaultDuration: 1, isChina: false, provider: 'amap' },
    collections: Array.isArray(parsed.collections) ? parsed.collections : [],
    photos: parsed.photos.map((p) => ({
      id: p.id ?? newPhotoId(),
      file: p.file ?? '',
      name: p.name ?? '',
      path: p.path ?? p.name ?? '',
      description: p.description ?? '',
      duration: p.duration ?? parsed.settings?.defaultDuration ?? 1,
      zoom: p.zoom ?? DEFAULT_ZOOM,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      date: p.date ?? null,
    })),
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

/**
 * Builds a self-contained .zip project: manifest.json + every image's bytes.
 * Re-openable with importProject without re-selecting the original folder.
 * `compress` toggles DEFLATE vs. plain STORE.
 */
export async function exportProject(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  collections: Collection[],
  opts: { compress: boolean }
): Promise<Blob> {
  const manifest = buildManifest(photos, settings, collections, 'full');
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
  collections: Collection[]
): Blob {
  const manifest = buildManifest(photos, settings, collections, 'reference');
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

  return { photos, collections: pruneCollections(manifest.collections, photos) };
}

/** Parses a reference-only .json file into a manifest (no images yet). */
export async function parseReferenceJson(file: File): Promise<Manifest> {
  return parseManifest(await file.text());
}

/**
 * Re-attaches a reference manifest to actual image files the user re-selected,
 * matching by relative path first, then by file name. Unmatched entries are
 * dropped (and their ids pruned from collections).
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

  return { photos, collections: pruneCollections(manifest.collections, photos) };
}
