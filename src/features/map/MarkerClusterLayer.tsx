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
  /** Id of the photo to render as a larger red marker (the active clip's photo). */
  highlightId?: string | null;
  /** When true, auto-open the highlighted marker's popup (off during playback — the overlay covers it). */
  openHighlightPopup?: boolean;
}

/**
 * Builds the popup as a DOM element (not an HTML string): title, date, the
 * photo, and its (read-only) description. Descriptions are edited in the clip
 * inspector, not here.
 */
function buildPopup(img: LocatedPhoto): HTMLElement {
  const container = document.createElement('div');
  container.className = 'photo-popup';

  const title = document.createElement('strong');
  title.textContent = img.name;

  const dateEl = document.createElement('div');
  dateEl.className = 'photo-popup__date';
  dateEl.textContent = img.date.toLocaleString();

  const image = document.createElement('img');
  image.src = img.url;
  image.width = 200;
  image.alt = img.name;

  container.append(title, dateEl, image);

  if (img.description) {
    const caption = document.createElement('div');
    caption.className = 'photo-popup__caption';
    caption.textContent = img.description;
    container.append(caption);
  }

  return container;
}

/**
 * Renders photo markers in a Leaflet markerCluster group via imperative side
 * effects (this component renders null). When `highlight` is set, the most
 * recent photo is drawn separately with the red icon and an opened popup.
 */
export const MarkerClusterLayer: React.FC<ClusterProps> = ({
  images,
  highlightId,
  openHighlightPopup = true,
}) => {
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

    // autoPan keeps the clicked marker's popup fully on screen (the map pans
    // if it would open at the edge); keepInView stays off so it doesn't fight
    // flyTo during playback/scrubbing.
    const bindPopup = (marker: L.Marker, img: LocatedPhoto) => {
      marker.bindPopup(() => buildPopup(img), {
        autoPan: true,
        autoPanPadding: L.point(48, 48),
        keepInView: false,
      });
    };

    const highlightImage = highlightId ? images.find((img) => img.id === highlightId) ?? null : null;
    const normalImages = highlightImage ? images.filter((img) => img.id !== highlightImage.id) : images;

    normalImages.forEach((img) => {
      const marker = L.marker([img.lat, img.lng], { icon: defaultIcon });
      bindPopup(marker, img);
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    let highlightMarker: L.Marker | null = null;
    if (highlightImage) {
      highlightMarker = L.marker([highlightImage.lat, highlightImage.lng], {
        icon: highlightIcon,
        zIndexOffset: 1000,
      });
      bindPopup(highlightMarker, highlightImage);
      highlightMarker.addTo(map);
      if (openHighlightPopup) highlightMarker.openPopup();
    }

    return () => {
      map.removeLayer(clusterGroup);
      if (highlightMarker) map.removeLayer(highlightMarker);
    };
  }, [map, images, highlightId, openHighlightPopup]);

  return null;
};

export default MarkerClusterLayer;
