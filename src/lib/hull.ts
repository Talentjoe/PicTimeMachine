/**
 * Convex hull (Andrew's monotone chain) over geographic points.
 *
 * Points are `[lat, lng]`; internally x = lng, y = lat. Returns the hull as an
 * ordered ring of `[lat, lng]` (counter-clockwise, no repeated last point).
 * Fewer than 3 unique points cannot form a polygon, so the input is returned
 * as-is — callers should skip drawing a polygon in that case.
 */
export function convexHull(points: [number, number][]): [number, number][] {
  const unique = dedupe(points);
  if (unique.length < 3) return unique;

  // Sort by x (lng) then y (lat).
  const pts = [...unique].sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));

  // cross product of OA × OB using x=lng (idx 1), y=lat (idx 0).
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);

  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Drop each list's last point (shared with the other list's first).
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function dedupe(points: [number, number][]): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const p of points) {
    const key = `${p[0]},${p[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}
