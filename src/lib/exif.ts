import EXIF from 'exif-js';
import { newPhotoId, DEFAULT_ZOOM, type PhotoPoint } from '../types/photo';

/** Default seconds each photo occupies on the timeline ("一秒一张"). */
export const DEFAULT_DURATION = 1;

/** Converts an EXIF [deg, min, sec] tuple to a signed decimal degree. */
export function dmsToDecimal(dms: [number, number, number], ref: string): number {
  const [deg, min, sec] = dms;
  const decimal = deg + min / 60 + sec / 3600;
  return ref === 'S' || ref === 'W' ? -decimal : decimal;
}

/**
 * Parses EXIF DateTimeOriginal ("YYYY:MM:DD HH:MM:SS") into a Date.
 * Returns null when the string is missing or malformed.
 */
export function parseCustomTime(timeStr?: string): Date | null {
  if (!timeStr) return null;
  const [year, month, day, hour, minute, second] = timeStr
    .split(/[:\s]/)
    .map(Number);
  if ([year, month, day].some(Number.isNaN)) return null;
  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

/**
 * Reads EXIF GPS + timestamp from each image file, returning de-duplicated
 * PhotoPoints sorted ascending by capture date.
 *
 * Existing photos can be passed in to append to (folder picks accumulate).
 * De-duplication is keyed by `path + date` — the previous `[...new Set(arr)]`
 * over an object array was a no-op since Set compares object references.
 */
export async function readPhotosFromFiles(
  files: File[],
  existing: PhotoPoint[] = []
): Promise<PhotoPoint[]> {
  const imageFiles = files.filter((f) => f.type.startsWith('image/'));
  const byKey = new Map<string, PhotoPoint>();

  const keyOf = (p: PhotoPoint) => `${p.path}|${p.date ? p.date.getTime() : 'na'}`;
  for (const photo of existing) byKey.set(keyOf(photo), photo);

  for (const file of imageFiles) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const exifData = EXIF.readFromBinaryFile(arrayBuffer);
      const lat = exifData.GPSLatitude
        ? dmsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef)
        : null;
      const lng = exifData.GPSLongitude
        ? dmsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef)
        : null;
      const date = parseCustomTime(exifData.DateTimeOriginal);

      const photo: PhotoPoint = {
        id: newPhotoId(),
        name: file.name,
        path: file.webkitRelativePath || file.name,
        url: URL.createObjectURL(file),
        description: '',
        duration: DEFAULT_DURATION,
        zoom: DEFAULT_ZOOM,
        lat,
        lng,
        date,
      };
      byKey.set(keyOf(photo), photo);
    } catch (err) {
      console.warn(`Failed to read EXIF from ${file.name}`, err);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const ta = a.date ? a.date.getTime() : 0;
    const tb = b.date ? b.date.getTime() : 0;
    return ta - tb;
  });
}
