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

export interface PrefetchSpec {
  url: string;
  subdomains?: string[];
  /** Target center, in the active basemap datum (GCJ-02 for Chinese maps). */
  lat: number;
  lng: number;
  zoom: number;
  /** How many tile rings around the center to warm at the target zoom (2 → 5×5). */
  radius?: number;
  /** Hard cap on the number of tile URLs enumerated per call. */
  maxTiles?: number;
}

/**
 * Enumerates the tile URLs to warm for a target (pure — unit-testable):
 * a block around the center at the destination zoom, plus small blocks at
 * two lower "approach" zooms (z-2, z-4) that a flyTo animation passes
 * through while zooming out and back in. Subdomains are rotated per tile so
 * the load spreads across the tile servers.
 */
export function tileUrlsFor(spec: PrefetchSpec): string[] {
  const { url, subdomains, lat, lng } = spec;
  const radius = spec.radius ?? 2;
  const maxTiles = spec.maxTiles ?? 48;
  const zBase = Math.round(spec.zoom);
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const subs = subdomains && subdomains.length ? subdomains : ['a'];
  const urls: string[] = [];
  let sIdx = 0;

  const pushBlock = (z: number, r: number) => {
    if (z < 0) return;
    const { x, y } = lngLatToTileXY(lat, lng, z);
    const max = 2 ** z;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= max || ty >= max) continue;
        if (urls.length >= maxTiles) return;
        urls.push(fillTileUrl(url, tx, ty, z, subs[sIdx++ % subs.length]));
      }
    }
  };

  pushBlock(zBase, radius);
  pushBlock(zBase - 2, 1);
  pushBlock(zBase - 4, 1);
  return urls;
}

/**
 * Recently-warmed tile URLs (bounded, insertion-ordered) so scrubbing back
 * and forth over the same clips doesn't re-request identical tiles.
 */
const recentlyWarmed = new Set<string>();
const RECENT_LIMIT = 500;

function markWarmed(u: string): void {
  recentlyWarmed.add(u);
  if (recentlyWarmed.size <= RECENT_LIMIT) return;
  // Evict the oldest fifth (Set iterates in insertion order).
  const drop = Math.floor(RECENT_LIMIT / 5);
  const it = recentlyWarmed.values();
  for (let i = 0; i < drop; i++) {
    const v = it.next();
    if (v.done) break;
    recentlyWarmed.delete(v.value);
  }
}

/** Warms the browser cache for the tiles around a target center/zoom. */
export function prefetchTiles(spec: PrefetchSpec): void {
  if (typeof Image === 'undefined') return;
  for (const u of tileUrlsFor(spec)) {
    if (recentlyWarmed.has(u)) continue;
    markWarmed(u);
    const img = new Image();
    img.src = u;
  }
}
