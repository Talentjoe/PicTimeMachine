// MarkerClusterGroupWrapper.tsx
import { useMap } from 'react-leaflet';
// @ts-ignore
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect } from 'react';
import './tile.css';

interface ClusterProps {
    images: {
        lat: number;
        lng: number;
        name: string;
        date?: Date;
        url: string;
    }[];
}

export const MarkerClusterGroupWrapper: React.FC<ClusterProps> = ({ images }) => {
    const map = useMap();

    useEffect(() => {
        const clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 80,
            disableClusteringAtZoom: 15,
            iconCreateFunction: (cluster: { getChildCount: () => any; }) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="custom-cluster">${count}</div>`,
                    className: 'my-cluster-icon',
                    iconSize: L.point(40, 40)
                });
            }
        });

        images.forEach((img) => {
            const marker = L.marker([img.lat, img.lng]);

            const popupContent = `
        <strong>${img.name}</strong><br/>
        ${img.date?.toLocaleString() || ''}<br/>
        <img src="${img.url}" width="200" />
      `;

            marker.bindPopup(popupContent);
            clusterGroup.addLayer(marker);
        });

        map.addLayer(clusterGroup);
        return () => {
            map.removeLayer(clusterGroup);
        };
    }, [map, images]);

    return null;
};
