import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect } from 'react';
import './markercluster.css';
import { defaultIcon, highlightIcon } from './icons';
import type { LocatedPhoto } from '../../types/photo';

interface ClusterProps {
  /** Photos to render; coordinates are expected to already match the basemap datum. */
  images: LocatedPhoto[];
  /** When true, the last image is rendered as a larger red marker with its popup open. */
  highlight?: boolean;
}

function popupHtml(img: LocatedPhoto): string {
  return `
    <strong>${img.name}</strong><br/>
    ${img.date.toLocaleString()}<br/>
    <img src="${img.url}" width="200" />
  `;
}

/**
 * Renders photo markers in a Leaflet markerCluster group via imperative side
 * effects (this component renders null). When `highlight` is set, the most
 * recent photo is drawn separately with the red icon and an opened popup.
 */
export const MarkerClusterLayer: React.FC<ClusterProps> = ({ images, highlight }) => {
  const map = useMap();

  useEffect(() => {
    if (!images || images.length === 0) return;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 13,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="my-cluster-icon custom-cluster">${count}</div>`,
          className: '',
          iconSize: [40, 40],
        });
      },
    });

    const highlightImage = highlight ? images[images.length - 1] : null;
    const normalImages = highlight ? images.slice(0, -1) : images;

    normalImages.forEach((img) => {
      const marker = L.marker([img.lat, img.lng], { icon: defaultIcon });
      marker.bindPopup(popupHtml(img));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    let highlightMarker: L.Marker | null = null;
    if (highlightImage) {
      highlightMarker = L.marker([highlightImage.lat, highlightImage.lng], {
        icon: highlightIcon,
        zIndexOffset: 1000,
      });
      highlightMarker.bindPopup(popupHtml(highlightImage));
      highlightMarker.addTo(map);
      highlightMarker.openPopup();
    }

    return () => {
      map.removeLayer(clusterGroup);
      if (highlightMarker) map.removeLayer(highlightMarker);
    };
  }, [map, images, highlight]);

  return null;
};

export default MarkerClusterLayer;
