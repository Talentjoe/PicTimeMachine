import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect, useRef } from 'react';
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
 * effects (this component renders null).
 *
 * Split into two effects on purpose: building the cluster + all markers is
 * O(N) and only re-runs when `images` change, while the highlight (which
 * changes on every clip during playback) is an O(1) swap — the highlighted
 * marker is pulled out of the cluster, restyled red, and pinned to the map;
 * the previous one is restored into the cluster.
 */
export const MarkerClusterLayer: React.FC<ClusterProps> = ({
  images,
  highlightId,
  openHighlightPopup = true,
}) => {
  const map = useMap();

  const groupRef = useRef<ReturnType<typeof L.markerClusterGroup> | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const highlightedIdRef = useRef<string | null>(null);

  // Effect A — build the cluster group + one marker per photo (images only).
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
    const markers = new Map<string, L.Marker>();
    images.forEach((img) => {
      const marker = L.marker([img.lat, img.lng], { icon: defaultIcon });
      marker.bindPopup(() => buildPopup(img), {
        autoPan: true,
        autoPanPadding: L.point(48, 48),
        keepInView: false,
      });
      markers.set(img.id, marker);
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    groupRef.current = clusterGroup;
    markersRef.current = markers;
    highlightedIdRef.current = null; // every marker starts inside the cluster

    return () => {
      map.removeLayer(clusterGroup);
      // A promoted highlight marker lives outside the group — drop it too
      // (removing a marker that isn't on the map is a no-op).
      markers.forEach((m) => map.removeLayer(m));
      groupRef.current = null;
      markersRef.current = new Map();
      highlightedIdRef.current = null;
    };
  }, [map, images]);

  // Effect B — swap the single highlighted marker (runs on every clip change,
  // and after each rebuild above thanks to the shared `images` dep).
  useEffect(() => {
    const group = groupRef.current;
    const markers = markersRef.current;
    if (!group) return;

    const prevId = highlightedIdRef.current;
    if (prevId && prevId !== highlightId) {
      const prev = markers.get(prevId);
      if (prev) {
        map.removeLayer(prev);
        prev.setIcon(defaultIcon);
        prev.setZIndexOffset(0);
        group.addLayer(prev);
      }
      highlightedIdRef.current = null;
    }

    if (highlightId && highlightId !== prevId) {
      const next = markers.get(highlightId);
      if (next) {
        group.removeLayer(next);
        next.setIcon(highlightIcon);
        next.setZIndexOffset(1000);
        next.addTo(map);
        if (openHighlightPopup) next.openPopup();
        highlightedIdRef.current = highlightId;
      }
    }
  }, [map, images, highlightId, openHighlightPopup]);

  return null;
};

export default MarkerClusterLayer;
