import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

interface FocusProps {
    points: { lat: number; lng: number }[];
}

const FocusOnMarkers: React.FC<FocusProps> = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        if (points.length === 0) return;

        if (points.length === 1) {
            map.flyTo([points[0].lat, points[0].lng], 13);
        } else {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [map, points]);

    return null;
};

export default FocusOnMarkers;
