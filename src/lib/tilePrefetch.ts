/**
 * Best-effort map tile preloading. Given a tile URL template and a target
 * center/zoom (already in the basemap datum), this computes the covering tile
 * coordinates and warms the browser HTTP cache by kicking off `new Image()`
 * loads. When the timeline later flies the map there, the tiles are already
 * cached, so the move feels instant. Purely additive — failures are ignored.
 *
 * Tile math is the standard Web Mercator (XYZ) scheme used by OSM, Amap and
 * Tianditu's `vec_w` layer alike.
 */

/** Converts lat/lng to integer tile {x,y} at zoom z (Web Mercator). */
export function lngLatToTileXY(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

/** Fills a Leaflet-style URL template ({s}/{z}/{x}/{y}) into a concrete tile URL. */
export function fillTileUrl(template: string, x: number, y: number, z: number, s: string): string {
  return template
    .replace('{s}', s)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

interface PrefetchOptions {
  url: string;
  subdomains?: string[];
  /** Target center, in the active basemap datum (GCJ-02 for Chinese maps). */
  lat: number;
  lng: number;
  zoom: number;
  /** How many tile rings around the center to warm (1 → 3×3). */
  radius?: number;
}

/** Warms the browser cache for the tiles around a target center/zoom. */
export function prefetchTiles({ url, subdomains, lat, lng, zoom, radius = 1 }: PrefetchOptions): void {
  if (typeof Image === 'undefined') return;
  const z = Math.round(zoom);
  if (!Number.isFinite(z) || z < 0) return;
  const { x, y } = lngLatToTileXY(lat, lng, z);
  const max = 2 ** z;
  const s = subdomains && subdomains.length ? subdomains[0] : 'a';
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= max || ty >= max) continue;
      const img = new Image();
      img.src = fillTileUrl(url, tx, ty, z, s);
    }
  }
}
