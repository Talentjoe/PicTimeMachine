import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

interface FitBoundsProps {
  positions: [number, number][];
  /** Optional animation duration (seconds); 0/undefined uses Leaflet's default. */
  duration?: number;
}

/** Fits the map viewport to all given positions (overview + collection clips). */
const FitBounds: React.FC<FitBoundsProps> = ({ positions, duration }) => {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, {
      padding: [40, 40],
      ...(duration ? { animate: true, duration } : {}),
    });
  }, [map, positions, duration]);

  return null;
};

export default FitBounds;
