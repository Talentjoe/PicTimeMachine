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
}

/**
 * During playback, flies the map to the current clip's photo over `moveDuration`
 * seconds (pan + zoom share the same duration so the camera motion stays in sync
 * with the timeline). When `animate` is false the view jumps instantly, which
 * keeps scrubbing snappy and interruptible (non-blocking). A small vertical
 * offset leaves room for the photo overlay / popup.
 */
const FocusOnMarkers: React.FC<FocusProps> = ({ point, moveDuration, animate }) => {
  const map = useMap();
  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;
  const zoom = point?.zoom ?? null;

  useEffect(() => {
    if (lat == null || lng == null || zoom == null) return;
    const targetPoint = map.project(L.latLng(lat, lng), zoom);
    const offsetLatLng = map.unproject(targetPoint.subtract([0, 80]), zoom);
    if (animate) {
      map.flyTo(offsetLatLng, zoom, { duration: Math.max(0, moveDuration) });
    } else {
      map.setView(offsetLatLng, zoom, { animate: false });
    }
  }, [map, lat, lng, zoom, moveDuration, animate]);

  return null;
};

export default FocusOnMarkers;
