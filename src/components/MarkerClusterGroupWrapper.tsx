import { useMap } from 'react-leaflet';
// @ts-ignore
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect } from 'react';
import './tile.css';
// @ts-ignore
import markerIconUrl from './marker-icon.png';
// @ts-ignore
import markerHighlightUrl from './marker-icon-red.png';

const defaultIcon = new L.Icon({
    iconUrl: markerIconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -40],
});

const highlightIcon = new L.Icon({
    iconUrl: markerHighlightUrl,
    iconSize: [35, 50],
    iconAnchor: [17, 50],
    popupAnchor: [0, -50],
});

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
        });

        const normalImages = images.slice(0, -1);
        const highlightImage = images[images.length - 1];

        // 普通 marker
        normalImages.forEach((img) => {
            const marker = L.marker([img.lat, img.lng], {
                icon: defaultIcon
            });

            const popupContent = `
      <strong>${img.name}</strong><br/>
      ${img.date?.toLocaleString() || ''}<br/>
      <img src="${img.url}" width="200" />
    `;
            marker.bindPopup(popupContent);
            clusterGroup.addLayer(marker);
        });

        map.addLayer(clusterGroup);

        if (highlightImage) {
            const highlightMarker = L.marker([highlightImage.lat, highlightImage.lng], {
                icon: highlightIcon,
                zIndexOffset: 1000, // ⬅️ 确保在最上层
            });

            const popupContent = `
      <strong>${highlightImage.name}</strong><br/>
      ${highlightImage.date?.toLocaleString() || ''}<br/>
      <img src="${highlightImage.url}" width="200" />
    `;
            highlightMarker.bindPopup(popupContent);
            highlightMarker.addTo(map);

            highlightMarker.openPopup(); // 可选：自动弹出
        }

        return () => {
            map.removeLayer(clusterGroup);
        };
    }, [map, images]);


    return null;
};
