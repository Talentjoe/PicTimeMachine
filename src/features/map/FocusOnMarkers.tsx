import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

interface FocusProps {
  points: { lat: number; lng: number }[];
}

/**
 * During playback, pans/zooms the map to the currently-active photo:
 * a single point is centered (with a vertical offset to leave room for its
 * popup); multiple points are framed via fitBounds.
 */
const FocusOnMarkers: React.FC<FocusProps> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      const zoom = 13;
      const targetLatLng = L.latLng(points[0].lat, points[0].lng);
      const targetPoint = map.project(targetLatLng, zoom);
      const offsetPoint = targetPoint.subtract([0, 150]);
      const offsetLatLng = map.unproject(offsetPoint, zoom);

      map.setZoom(zoom);
      map.panTo(offsetLatLng, { animate: true, duration: 1.0 });
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, points]);

  return null;
};

export default FocusOnMarkers;
