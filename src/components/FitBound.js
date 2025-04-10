import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

interface FitBoundsProps {
    positions: [number, number][];
}

const FitBounds: React.FC<FitBoundsProps> = ({ positions }) => {
    const map = useMap();

    useEffect(() => {
        if (positions.length === 0) return;
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [40, 40] });
    }, [map, positions]);

    return null;
};

export default FitBounds;
