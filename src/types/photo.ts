/**
 * A single photo parsed from a user-selected image file.
 *
 * `lat`/`lng`/`date` are nullable because not every image carries valid EXIF
 * GPS or timestamp data; such photos are still listed but filtered out of the
 * map. Coordinates are WGS-84 (the EXIF standard); conversion to GCJ-02 for
 * Chinese basemaps happens at render time in the map layer (see lib/geo.ts).
 */
export interface PhotoPoint {
  name: string;
  /** Object URL created via URL.createObjectURL for in-browser preview. */
  url: string;
  lat: number | null;
  lng: number | null;
  date: Date | null;
}

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
