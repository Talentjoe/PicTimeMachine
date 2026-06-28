import L from 'leaflet';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import markerIconUrl from './marker-icon.png';
import markerHighlightUrl from './marker-icon-red.png';

/** Standard blue marker (with shadow). */
export const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Larger red marker used to highlight the current photo during playback. */
export const highlightIcon = L.icon({
  iconUrl: markerHighlightUrl,
  iconSize: [35, 50],
  iconAnchor: [17, 50],
  popupAnchor: [0, -50],
});

// Make every default Leaflet marker use our blue icon.
L.Marker.prototype.options.icon = defaultIcon;
