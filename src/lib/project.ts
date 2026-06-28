import JSZip from 'jszip';
import { newPhotoId, type PhotoPoint } from '../types/photo';

/** Global settings persisted alongside the photos in a project file. */
export interface ProjectSettings {
  defaultDuration: number;
  isChina: boolean;
  provider: string;
}

/** One photo entry inside the manifest. `file` is its path within the zip. */
export interface ManifestPhoto {
  file: string;
  name: string;
  path: string;
  description: string;
  duration: number;
  lat: number | null;
  lng: number | null;
  /** ISO string, or null when the photo has no timestamp. */
  date: string | null;
}

export interface Manifest {
  version: 1;
  settings: ProjectSettings;
  /** Array order is the display order. */
  photos: ManifestPhoto[];
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
export function buildManifest(photos: PhotoPoint[], settings: ProjectSettings): Manifest {
  return {
    version: 1,
    settings,
    photos: photos.map((p, i) => ({
      file: zipEntryName(p, i),
      name: p.name,
      path: p.path,
      description: p.description,
      duration: p.duration,
      lat: p.lat,
      lng: p.lng,
      date: p.date ? p.date.toISOString() : null,
    })),
  };
}

export function serializeManifest(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function parseManifest(json: string): Manifest {
  const parsed = JSON.parse(json) as Manifest;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.photos)) {
    throw new Error('无法识别的项目文件（manifest 格式不正确）');
  }
  return parsed;
}

/**
 * Builds a self-contained .zip project: manifest.json + every image's bytes.
 * The same file can be re-opened with importProject without re-selecting the
 * original folder. `compress` toggles DEFLATE vs. plain STORE.
 */
export async function exportProject(
  photos: PhotoPoint[],
  settings: ProjectSettings,
  opts: { compress: boolean }
): Promise<Blob> {
  const manifest = buildManifest(photos, settings);
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

/** Reconstructs PhotoPoints (with fresh object URLs) from a .zip project file. */
export async function importProject(file: File): Promise<PhotoPoint[]> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file(MANIFEST_NAME);
  if (!manifestFile) throw new Error('项目文件缺少 manifest.json');

  const manifest = parseManifest(await manifestFile.async('string'));

  const photos = await Promise.all(
    manifest.photos.map(async (entry): Promise<PhotoPoint | null> => {
      const imageFile = zip.file(entry.file);
      if (!imageFile) {
        console.warn(`项目文件缺少图片：${entry.file}`);
        return null;
      }
      const blob = await imageFile.async('blob');
      return {
        id: newPhotoId(),
        name: entry.name,
        path: entry.path,
        url: URL.createObjectURL(blob),
        description: entry.description ?? '',
        duration: entry.duration ?? manifest.settings.defaultDuration ?? 1,
        lat: entry.lat,
        lng: entry.lng,
        date: entry.date ? new Date(entry.date) : null,
      };
    })
  );

  return photos.filter((p): p is PhotoPoint => p !== null);
}
