import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

interface FocusProps {
  /** The single point to focus, already in the active basemap datum. */
  point: { lat: number; lng: number; zoom: number } | null;
  /** Seconds the fly animation should take (matches the clip's move phase). */
  moveDuration: number;
  /** When true, fly with animation; when false (scrubbing/paused), jump instantly. */
  animate: boolean;
  /** Where the marker should sit relative to the viewport center (px; +x right,
   *  +y down) — keeps it clear of the photo overlay. Default: dead center. */
  offset?: [number, number];
}

/**
 * During playback, flies the map to the current clip's photo over `moveDuration`
 * seconds (pan + zoom share the same duration so the camera motion stays in sync
 * with the timeline). When `animate` is false the view jumps instantly, which
 * keeps scrubbing snappy and interruptible (non-blocking). `offset` shifts the
 * marker away from the viewport center so the photo overlay doesn't cover it.
 */
const FocusOnMarkers: React.FC<FocusProps> = ({ point, moveDuration, animate, offset }) => {
  const map = useMap();
  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;
  const zoom = point?.zoom ?? null;
  const offsetX = offset?.[0] ?? 0;
  const offsetY = offset?.[1] ?? 0;

  useEffect(() => {
    if (lat == null || lng == null || zoom == null) return;
    const targetPoint = map.project(L.latLng(lat, lng), zoom);
    // Centering on (marker - offset) renders the marker at (center + offset).
    const offsetLatLng = map.unproject(targetPoint.subtract([offsetX, offsetY]), zoom);
    if (animate) {
      map.flyTo(offsetLatLng, zoom, { duration: Math.max(0, moveDuration) });
    } else {
      map.setView(offsetLatLng, zoom, { animate: false });
    }
  }, [map, lat, lng, zoom, moveDuration, animate, offsetX, offsetY]);

  return null;
};

export default FocusOnMarkers;
